/**
 * sass 编译监听工具
 */
const path = require('path');
const chokidar = require('chokidar');
const sass = require('sass');
const autoprefixer = require('autoprefixer');
const postcss = require('postcss');
const fsTool = require('./fs-tool');
const crypto = require('crypto');
// 16位md5
const md5 = (str) => {
    const md5 = crypto.createHash('md5');
    md5.update(str);
    return md5.digest('hex').substring(8, 24);
};

/**
 * sass监听编译
 */
class SassWatchCompile {
    constructor() {
        this.rule = [];
        this.regexp = {
            // 压缩编译
            compressed: /^\/\/\s?compileCompressed:\s?(.*)/,
            // 展开编译
            expanded: /^\/\/\s?compileExpanded:\s?(.*)/,
            // import
            import: /@import ['|"](.*)['|"];/,
        };
        this.rulePathRelated = {};
        this.chokidarWatcher = {};
        this.sassImportRelated = {};

        this.loadRulePath();
    }

    /**
     * 加载规则目录
     */
    async loadRulePath() {
        const rulePath = path.join(__dirname, './rule/');
        const events = ['add', 'change', 'unlink'];
        chokidar.watch(rulePath).on('all', (type, fullPath) => {
            const filePathInfo = path.parse(fullPath);
            const fileExt = filePathInfo.ext.toLowerCase();
            if (fileExt !== '.json') {
                return null;
            }
            if (!events.includes(type)) {
                return null;
            }
            switch (type) {
                case 'add':
                case 'change':
                    this.mountRuleConfig(fullPath);
                    break;
                case 'unlink':
                    const keys = Object.keys(this.rulePathRelated);
                    // 删除匹配的关联监听
                    keys.forEach((i) => {
                        if (this.rulePathRelated[i] === fullPath) {
                            this.chokidarWatcher[i].close().then(() => {
                                delete this.rulePathRelated[i];
                                delete this.chokidarWatcher[i];
                            });
                        }
                    });
                    break;
                default:
            }
        });
    }

    /**
     * 挂载规则
     */
    async mountRuleConfig(filePath) {
        const filePathStat = await fsTool.getStat(filePath);
        if (!filePathStat || !filePathStat.isFile()) {
            return this;
        }
        const fileContent = await fsTool.readFile(filePath, 'utf8');
        let data = null;
        try {
            data = JSON.parse(fileContent);
        } catch (err) {
            return this;
        }
        if (Array.isArray(data)) {
            data.forEach((i) => {
                // 把目录关系关联到规则文件
                const pathMD5Name = md5(i);
                this.rulePathRelated[pathMD5Name] = filePath;
                this.loadSassByFolder(i);
            });
        }
        return this;
    }

    /**
     * 监听源文件目录
     * @param {string} loadPath 读取目录
     */
    async loadSassByFolder(loadPath) {
        const watchPathStat = await fsTool.getStat(loadPath);
        if (!watchPathStat || !watchPathStat.isDirectory()) {
            return this;
        }
        const pathMD5Name = md5(loadPath);
        if (this.chokidarWatcher[pathMD5Name]) {
            return this;
        }
        // 创建目录的watcher
        const watcher = chokidar.watch(loadPath);
        this.chokidarWatcher[pathMD5Name] = watcher;
        watcher.on('all', (type, fullPath) => {
            const pathInfo = path.parse(fullPath);
            const fileExt = pathInfo.ext.toLowerCase();
            if (fileExt !== '.scss' && fileExt !== '.sass') {
                return null;
            }
            const fileMD5Name = md5(fullPath);
            switch (type) {
                // /**
                //  * 添加（首次监听也是add）
                //  * 判断是否为需要编译
                //  */
                // case 'add':
                //     this.preLoadSassInfo(fullPath, pathInfo);
                //     break;
                /**
                 * 文件变化
                 * 判断在关联中是否存在，存在编译关联文件
                 * 不存在判断是否为需要编译
                 */
                case 'change':
                    if (this.sassImportRelated[fileMD5Name]) {
                        this.preLoadSassInfo(this.sassImportRelated[fileMD5Name]);
                    } else {
                        this.preLoadSassInfo(fullPath, pathInfo);
                    }
                    break;
                /**
                 * 文件删除
                 * 删除这个文件的关联
                 */
                case 'unlink':
                    /**
                     * import文件被删除
                     */
                    if (this.sassImportRelated[fileMD5Name]) {
                        /**
                         * 理论上应该重新编译一次sass
                         * 考虑到编辑的同步性，编译文件那边的import可能还没有被去掉，所以不执行重新编译
                         */
                        // this.preLoadSassInfo(this.sassImportRelated[fileMD5Name]);
                        // 删除这个import文件的关联记录
                        delete this.sassImportRelated[fileMD5Name];
                    } else {
                        /**
                         * 如果这个文件被删除
                         * 又不在import关联中
                         * 多半是编译sass文件
                         * 遍历import关联，删除与这个文件相关的import
                         */
                        const keys = Object.keys(this.sassImportRelated);
                        keys.forEach((i) => {
                            if (this.sassImportRelated[i] === fullPath) {
                                delete this.sassImportRelated[i];
                            }
                        });
                    }
                    break;
                default:
            }
        });
        return this;
    }

    /**
     * 预读取
     */
    async preLoadSassInfo(filePath, pathInfo = null) {
        const filePathInfo = pathInfo || path.parse(filePath);
        const fileContent = await fsTool.readFile(filePath, 'utf8');
        let compileType = null;
        let compilePath = null;
        const hasCompressed = fileContent.match(this.regexp.compressed);
        const hasExpanded = hasCompressed ? null : fileContent.match(this.regexp.expanded);
        if (hasCompressed) {
            compilePath = path.resolve(filePathInfo.dir, hasCompressed[1]);
            compileType = 'compressed';
        } else if (hasExpanded) {
            compilePath = path.resolve(filePathInfo.dir, hasCompressed[1]);
            compileType = 'expanded';
        }
        if (compileType && compilePath) {
            this.compileSassFile(fileContent, filePathInfo, compilePath, compileType);
        }
    }

    /**
     * 编译sass文件
     * @param {string} content 文件正文内容
     * @param {object} pathInfo Path Info
     * @param {string} compilePath 编译文件保存路径
     * @param {string} compileType 编译类型
     */
    async compileSassFile(content, pathInfo, compilePath, compileType) {
        let sassContent = content;
        sassContent = await this.replaceSassImport(sassContent, pathInfo.dir, path.format(pathInfo));
        const {
            css,
            err,
        } = await this.compileSass({
            data: sassContent,
            outputStyle: compileType,
        });
        if (err) {
            await fsTool.saveFile(compilePath, `
            CompileSass Fail
            ${JSON.stringify(err)}
            `);
            return this;
        }
        const {
            postcss,
            posterr,
        } = await this.postcssTransform(css);
        if (posterr) {
            await fsTool.saveFile(compilePath, `
            PostcssTransform
            ${JSON.stringify(posterr)}
            `);
            return this;
        }
        await fsTool.saveFile(compilePath, postcss);
    }

    /**
     * 替换sass中import的sass文件
     * 同时关联文件的刷新编译
     * @param {string} content 正文内容
     * @param {string} dir 文件所在文件夹路径
     */
    async replaceSassImport(content, dir, relatedFilePath) {
        let sassContent = content;
        const hasImport = content.match(new RegExp(this.regexp.import, 'g'));
        if (hasImport) {
            for (let i = 0, n = hasImport.length; i < n; i++) {
                const item = hasImport[i];
                let importSassContent = '';
                // 匹配文件名
                let importName = item.match(this.regexp.import);
                importName = importName ? importName[1].replace(/\s/g, '') : false;
                if (importName) {
                    const importSassFilePath = path.resolve(dir, importName);
                    const importSassFileContent = await fsTool.readFile(importSassFilePath, 'utf8');
                    const importSassDir = path.parse(importSassFilePath).dir;
                    importSassContent = await this.replaceSassImport(importSassFileContent, importSassDir, relatedFilePath);
                    const fileMD5Name = md5(importSassFilePath);
                    this.sassImportRelated[fileMD5Name] = relatedFilePath;
                }
                sassContent = sassContent.replace(item, importSassContent);
            }
        }
        return sassContent;
    }

    /**
     * 编译sass文件
     * @param {object} options
     */
    compileSass(options) {
        return new Promise((resolve) => {
            sass.render(options, (err, res) => {
                resolve({
                    err,
                    css: res.css.toString('utf8'),
                });
            });
        });
    }

    /**
     * PostCSS处理
     * @param {string} css css正文
     */
    postcssTransform(css) {
        return new Promise((resolve) => {
            postcss([ autoprefixer ]).process(css, {
                from: undefined,
            }).then((res) => {
                resolve({
                    postcss: res,
                });
            }).catch((err) => {
                resovle({
                    posterr: err,
                });
            });
        });
    }
}

new SassWatchCompile();
