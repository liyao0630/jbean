"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const FS = require("fs");
const Path = require("path");
const utils_1 = require("../utils");
const component_scan_1 = require("./component_scan");
const helper_1 = require("./helper");
const configParser = {
    json: function (content) {
        if (!content) {
            return null;
        }
        return JSON.parse(content);
    }
};
function registerConfigParser(key, parser) {
    configParser[key] = parser;
}
exports.registerConfigParser = registerConfigParser;
const appConfigs = {};
component_scan_1.registerScanner(function (fpath, isExclude, isFile) {
    // console.log(fpath, isExclude, isFile)
    if (!isFile || isExclude) {
        return;
    }
    const ext = Path.extname(fpath).substr(1);
    if (typeof configParser[ext] === 'function') {
        let content = configParser[ext](FS.readFileSync(fpath, 'utf8'));
        if (!content) {
            return;
        }
        utils_1.merge(appConfigs, content);
    }
});
const app = function (target, options) {
    // do component scan
    component_scan_1.scan(target);
    if (typeof target['main'] === 'function') {
        setTimeout(() => {
            target['main'](utils_1.merge(appConfigs, options));
        }, 0);
    }
};
function JBootApplication(target, options) {
    return helper_1.annotationHelper(helper_1.AnnotationType.clz, app, arguments);
}
exports.default = JBootApplication;
