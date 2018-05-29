const fs = require('fs');
const path = require('path');
const url = require('url');

const mkdir = require('./mkdir');

const util = {
    getStat(loadPath) {
        return new Promise((resolve) => {
            fs.stat(loadPath, (err, stats) => {
                if (err) {
                    console.log(err);
                    resolve(null);
                } else {
                    resolve(stats);
                }
            });
        });
    },
    readDir(dirPath) {
        return new Promise((resolve) => {
            fs.readdir(dirPath, (err, list) => {
                if (err) {
                    resolve(null);
                } else {
                    resolve(list);
                }
            });
        });
    },
    readFile(filePath, mode = null) {
        return new Promise((resolve) => {
            fs.readFile(filePath, mode, (err, data) => {
                if (err) {
                    resolve(null);
                } else {
                    resolve(data);
                }
            });
        });
    },
    async saveFile(savepath, buffer) {
        let savepath_info = path.parse(savepath);
        await mkdir(savepath_info.dir);
        return new Promise((resolve, reject) => {
            fs.writeFile(savepath, buffer, (err) => {
                if (err) {
                    console.log(err);
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        });
    },
    async saveText(savepath, content) {
        let savepath_info = path.parse(savepath);
        await mkdir(savepath_info.dir);
        return new Promise((resolve, reject) => {
            fs.writeFile(savepath, content, {flag: 'w+'}, err => {
                if (err) {
                    console.log(err);
                    reject(false);
                } else {
                    resolve(true);
                }
            })
        })
    }
}

exports = module.exports = util;
