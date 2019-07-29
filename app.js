const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const sass = require('node-sass');
const autoprefixer = require('autoprefixer');
const postcss = require('postcss');

const fsTool = require('./fs.tool');

/**
 * 规则存放路径
 */
const watchPath = path.join(__dirname, './rule/');
const watchList = {};

/**
 * 第一行编译的sass规则
 */
const sass_reg = {
    compressed: /^\/\/\s?compileCompressed:\s?(.*)/,
    expanded: /^\/\/\s?compileExpanded:\s?(.*)/,
    getImport: /@import ['|"](.*)['|"];/,
};

/**
 * 启动时，监听配置
 */
const watchConfig = function() {
    // 调用chokidar监听
    chokidar.watch(watchPath).on('all', (e, fullpath) => {
        watchJson(e, fullpath);
    });
};

/**
 * 处理配置文件
 */
const watchJson = async function(e, fullpath) {
    if (fullpath.lastIndexOf('.json') !== fullpath.length - 5) return null;
    let filename = fullpath.split('.')[0];
    filename = filename.replace(watchPath, '');
    // 监听add
    if (e === 'add' || e === 'change') {
        let data = await fsTool.readFile(fullpath, 'utf8');
        try {
            data = JSON.parse(data);
        } catch (err) {
            return null;
        }
        // change的时候，重新加入监听列表，防止漏听
        if (watchList[filename] && watchList[filename].length) {
            console.log(item);
            watchList[filename].forEach(item => chokidar.unwatch(item));
        }
        watchList[filename] = [];
        if (Array.isArray(data)) {
            data.forEach(async (item) => {
                const pathStat = await fsTool.getStat(item.path);
                if (pathStat && pathStat.isDirectory()) {
                    watchSassPath(item.path);
                    watchList[filename].push(item.path);
                }
            });
        } else {
            const pathStat = await fsTool.getStat(data.path);
            if (pathStat && pathStat.isDirectory()) {
                watchSassPath(data.path);
                watchList[filename].push(item.path);
            }
        }
    } else if (e === 'unlink' && watchList[filename]) {
        if (watchList[filename].length) {
            watchList[filename].forEach(item => chokidar.unwatch(item));
        }
        delete watchList[filename];
    }
};

/**
 * 监听sass文件路径
 */
const watchSassPath = function(path) {
    // 调用chokidar监听
    chokidar.watch(path).on('all', (e, fullpath) => {
        watchSass(e, fullpath);
    });
};

/**
 * sass文件监听
 * sass的编译只监听change
 */
const watchSass = async function(e, fullpath) {
    const isSass = fullpath.lastIndexOf('.sass') !== fullpath.length - 5;
    const isScss = fullpath.lastIndexOf('.scss') !== fullpath.length - 5;
    if (!isSass && !isScss) return null;
    if (e !== 'change') return null;
    let data = await fsTool.readFile(fullpath, 'utf8');
    let hasCompressed = data.match(sass_reg.compressed);
    if (hasCompressed) {
        const pathInfo = path.parse(fullpath);
        const compilePath = path.resolve(pathInfo.dir, hasCompressed[1]);
        return await compileSass(data, pathInfo.dir, 'compressed', compilePath);
    }
    let hasExpanded = data.match(sass_reg.expanded);
    if (hasExpanded) {
        const pathInfo = path.parse(fullpath);
        const compilePath = path.resolve(pathInfo.dir, hasExpanded[1]);
        return await compileSass(data, pathInfo.dir, 'expanded', compilePath);
    }
    return false;
};

/**
 * 将读取的sass内容编译为css，postcss增加前缀
 */
const compileSass = async function(data, dir, outputStyle = 'compressed', savepath) {
    let sassData = data;
    if (sassData.indexOf('import') > -1) {
        sassData = await getSassImport(sassData, dir);
    }
    let css = await compileSassToCss(sassData, outputStyle);
    if (css.css) {
        css = await postcssTransform(css.css);
        if (css.css) {
            css = css.css;
        } else {
            css = `postcssTransform${JSON.stringify(css.err)}`;
        }
    } else {
        css = `compileSassToCss${JSON.stringify(css.err)}`;
    }
    const status = await fsTool.saveText(savepath, css);
    
    return status;
};

const getSassImport = async function(data, dir) {
    let sassData = data;
    const hasImport = data.match(new RegExp(sass_reg.getImport, 'g'));
    if (hasImport) {
        for (let i = 0, n = hasImport.length; i < n; i++) {
            const item = hasImport[i];
            // 匹配文件名
            let importName = item.match(sass_reg.getImport);
            importName = importName ? importName[1].replace(/\s/g, '') : false;
            if (!importName) {
                // 在sassData中移除import
                sassData = sassData.replace(item, '');
                continue;
            } else {
                const importSassData = await getSassFileData(importName, dir);
                sassData = sassData.replace(item, importSassData);
            }
        }
    }
    return sassData;
};

const getSassFileData = async function(filename, dir) {
    let fileInfo = path.join(dir, filename+'.scss');
    fileInfo = path.parse(fileInfo);
    const filePaths = [];
    filePaths.push(path.join(fileInfo.dir, `./${fileInfo.name}.sass`));
    filePaths.push(path.join(fileInfo.dir, `./_${fileInfo.name}.sass`));
    filePaths.push(path.join(fileInfo.dir, `./${fileInfo.name}.scss`));
    filePaths.push(path.join(fileInfo.dir, `./_${fileInfo.name}.scss`));
    
    for (let i = 0; i < 4; i++) {
        let stat = await fsTool.getStat(filePaths[i]);
        if (stat && stat.isFile()) {
            let sassData = await fsTool.readFile(filePaths[i], 'utf8');
            if (sassData.indexOf('import') > -1) {
                sassData = await getSassImport(sassData, fileInfo.dir);
            }
            return sassData;
        }
    }
    return '';
};

/**
 * sass转css
 */
const compileSassToCss = function(data, outputStyle) {
    return new Promise((resolve) => {
        sass.render({ data, outputStyle }, (err, res) => {
            if (err) {
                fsTool.saveText(path.join(__dirname, './debug.txt'), data.toString('utf8'));
                resolve({
                    err,
                });
            } else {
                const css = res.css.toString('utf8');
                resolve({
                    css,
                });
            }
        });
    });
};

/**
 * postcss处理
 */
const postcssTransform = function(css) {
    return new Promise((resolve) => {
        postcss([ autoprefixer ]).process(css, {from: undefined}).then((res) => {
            resolve(res);
        });
    });
};

// 开始监听
watchConfig();
