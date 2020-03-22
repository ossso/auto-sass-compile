const crypto = require('crypto');

exports = module.exports = (str) => {
    const md5 = crypto.createHash('md5');
    md5.update(str);
    return md5.digest('hex');
};
