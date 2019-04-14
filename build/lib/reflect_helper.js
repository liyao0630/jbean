"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const bean_factory_1 = require("./bean_factory");
const utils_1 = require("./utils");
const BEFORE_CALL_NAME = 'beforeCall';
const AFTER_CALL_NAME = 'afterCall';
class ReflectHelper {
    static getMethods(ctor, checkBeforeAfterCaller) {
        return Object.getOwnPropertyNames(ctor.prototype).filter((item) => {
            if (item === 'constructor') {
                return false;
            }
            if (!checkBeforeAfterCaller &&
                (item === BEFORE_CALL_NAME ||
                    item === AFTER_CALL_NAME)) {
                return false;
            }
            return typeof ctor.prototype[item] === 'function';
        });
    }
    static getParentMethods(ctor, checkBeforeAfterCaller) {
        const parent = Object.getPrototypeOf(ctor);
        if (!parent.prototype) {
            return null;
        }
        return ReflectHelper.getMethods(parent, checkBeforeAfterCaller);
    }
    static methodExist(ctor, method, loopCnt, checkBeforeAfterCaller) {
        let ctor0 = ctor;
        let loop = 0;
        if (!loopCnt || loopCnt < 1) {
            loopCnt = 10;
        }
        while (true) {
            if (loop >= loopCnt) {
                return false;
            }
            const methods = ReflectHelper.getMethods(ctor0, checkBeforeAfterCaller);
            if (methods && methods.indexOf(method) >= 0) {
                return true;
            }
            ctor0 = Object.getPrototypeOf(ctor0);
            if (!ctor0.prototype) {
                return false;
            }
            loop++;
        }
    }
    static resetMethod(ctor, method, classAnnos, methodsAnnos) {
        classAnnos = classAnnos || [];
        methodsAnnos = methodsAnnos || [];
        let annos = [];
        for (let i = 0; i < classAnnos.length; i++) {
            let existInMethod = false;
            for (let j = 0; j < methodsAnnos.length; j++) {
                if (methodsAnnos[j][0] === classAnnos[i][0]) {
                    existInMethod = true;
                    break;
                }
            }
            if (existInMethod) {
                continue;
            }
            annos.push(classAnnos[i]);
        }
        annos = annos.concat(methodsAnnos);
        const originFunc = ctor.prototype[method];
        const callerStack = [];
        let hasAsyncFunc = false;
        annos.forEach(([caller, args]) => {
            if (typeof caller.preCall !== 'function') {
                return;
            }
            callerStack.push([false, false, false, utils_1.isAsyncFunction(caller.preCall), caller.preCall, args]);
            hasAsyncFunc = hasAsyncFunc || utils_1.isAsyncFunction(caller.preCall);
        });
        if (ReflectHelper.methodExist(ctor, BEFORE_CALL_NAME, 0, true)) {
            callerStack.push([true, false, false, utils_1.isAsyncFunction(ctor.prototype[BEFORE_CALL_NAME]), ctor.prototype[BEFORE_CALL_NAME], null]);
            hasAsyncFunc = hasAsyncFunc || utils_1.isAsyncFunction(ctor.prototype[BEFORE_CALL_NAME]);
        }
        callerStack.push([true, true, true, utils_1.isAsyncFunction(originFunc), originFunc, null]);
        hasAsyncFunc = hasAsyncFunc || utils_1.isAsyncFunction(originFunc);
        if (ReflectHelper.methodExist(ctor, AFTER_CALL_NAME, 0, true)) {
            callerStack.push([true, true, false, utils_1.isAsyncFunction(ctor.prototype[AFTER_CALL_NAME]), ctor.prototype[AFTER_CALL_NAME], null]);
            hasAsyncFunc = hasAsyncFunc || utils_1.isAsyncFunction(ctor.prototype[AFTER_CALL_NAME]);
        }
        annos.forEach(([caller, args]) => {
            if (typeof caller.postCall !== 'function') {
                return;
            }
            callerStack.push([false, true, false, utils_1.isAsyncFunction(caller.postCall), caller.postCall, args]);
            hasAsyncFunc = hasAsyncFunc || utils_1.isAsyncFunction(caller.postCall);
        });
        const prepareCallerParams = function (callerInfo, args0, ret) {
            const [needCtx, needRet, isOriginFunc, isAsyncFunc, caller, args1] = callerInfo;
            let args = [];
            if (needRet && !isOriginFunc) {
                args.push(ret);
            }
            if (args1) {
                args = args.concat(args1);
            }
            args = args.concat(args0);
            if (isOriginFunc) {
                args = args0;
            }
            return [caller, needCtx, isAsyncFunc, args];
        };
        if (hasAsyncFunc) {
            ctor.prototype[method] = function () {
                return __awaiter(this, arguments, void 0, function* () {
                    let currentCallIdx = 0;
                    const callerStackLen = callerStack.length;
                    const args0 = Array.prototype.slice.call(arguments, 0);
                    let preRet = null;
                    while (currentCallIdx < callerStackLen) {
                        const [caller, needCtx, isAsyncFunc, args] = prepareCallerParams(callerStack[currentCallIdx], args0, preRet);
                        const ctx = needCtx ? this : null;
                        if (isAsyncFunc) {
                            preRet = yield caller.call(ctx, ...args);
                        }
                        else {
                            preRet = caller.call(ctx, ...args);
                        }
                        currentCallIdx++;
                    }
                    return preRet;
                });
            };
        }
        else {
            ctor.prototype[method] = function () {
                let currentCallIdx = 0;
                const callerStackLen = callerStack.length;
                const args0 = Array.prototype.slice.call(arguments, 0);
                let preRet = null;
                while (currentCallIdx < callerStackLen) {
                    const [caller, needCtx, isAsyncFunc, args] = prepareCallerParams(callerStack[currentCallIdx], args0, preRet);
                    const ctx = needCtx ? this : null;
                    preRet = caller.call(ctx, ...args);
                    currentCallIdx++;
                }
                return preRet;
            };
        }
    }
    static resetClass(ctor) {
        const beanMeta = bean_factory_1.default.getBeanMeta(ctor);
        if (!beanMeta) {
            return;
        }
        ReflectHelper.getMethods(ctor).forEach((method) => {
            ReflectHelper.resetMethod(ctor, method, beanMeta.clzAnnos, beanMeta.methodAnnos[method]);
        });
    }
}
exports.default = ReflectHelper;
