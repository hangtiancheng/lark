/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * vue2 的双向数据绑定基于 Object.defineProperty();
 * 创建一个 Vue 实例时，for..in 遍历 vm.data 中的所有属性，使用 Object.defineProperty() 将属性转换为 getter 和 setter
 * vue3 的双向数据绑定基于 Proxy 代理对象
 *
 * 优势
 * 1. 省略 for..in 遍历
 * 2. 可以监听数组的 length 属性，数组的索引
 * 3. 可以监听新增属性操作、删除属性操作
 */

import {
  mutableHandler,
  readonlyHandler,
  shallowReadonlyHandler,
} from "./base-handlers";

export const enum ReactiveFlags {
  IS_REACTIVE = "__v_isReactive",
  IS_READONLY = "__v_isReadonly",
}

export function reactive<T extends object>(target: T) {
  return new Proxy<T>(target /** 被代理对象 */, mutableHandler);
}

export function readonly<T extends object>(target: T) {
  return new Proxy<T>(target, readonlyHandler);
}

export function isReactive(target: any) {
  return target[ReactiveFlags.IS_REACTIVE] ?? false;
}

export function isReadonly(target: any) {
  return target[ReactiveFlags.IS_READONLY] ?? false;
}

export function shallowReadonly<T extends object>(target: T) {
  return new Proxy<T>(target, shallowReadonlyHandler);
}
