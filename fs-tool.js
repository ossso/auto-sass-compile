const fs = require('fs');
const path = require('path');

exports = module.exports = {
    getStat(loadPath, isReject = false) {
        return new Promise((resolve, reject) => {
            fs.stat(loadPath, (err, stats) => {
                if (err) {
                    if (isReject) {
                        reject(err);
                    } else {
                        resolve(null);
                    }
                } else {
                    resolve(stats);
                }
            });
        });
    },
    readDir(dirPath) {
        return new Promise((resolve, reject) => {
            fs.readdir(dirPath, (err, list) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(list);
                }
            });
        });
    },
    readFile(filePath, mode = null) {
        return new Promise((resolve, reject) => {
            fs.readFile(filePath, mode, (err, data) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            });
        });
    },
    deleteFile(filePath) {
        return new Promise((resolve, reject) => {
            fs.unlink(filePath, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    },
    async mkdir(dir) {
        const dirStat = await this.getStat(dir);
        return new Promise((resolve, reject) => {
            if (dirStat) {
                if (dirStat.isDirectory()) {
                    return resolve(dir);
                } else if (dirStat.isFile()) {
                    return reject('该路径是已存在的文件');
                }
            }
            fs.mkdir(dir, {
                recursive: true
            }, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(dir);
                }
            });
        });
    },
    async saveFile(savepath, buffer) {
        const savepath_info = path.parse(savepath);
        await this.mkdir(savepath_info.dir);
        return new Promise((resolve, reject) => {
            fs.writeFile(savepath, buffer, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(savepath);
                }
            });
        });
    },
    async saveText(savepath, content, flag = 'w+') {
        const savepath_info = path.parse(savepath);
        await this.mkdir(savepath_info.dir);
        return new Promise((resolve, reject) => {
            fs.writeFile(savepath, content, {
                flag
            }, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(savepath);
                }
            });
        });
    },
};
