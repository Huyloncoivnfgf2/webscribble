import { JSDOM } from 'jsdom'
import DOMPurify from 'dompurify'
import type { ConvertDocxOptions } from '../../src/engines/word/index'
import type { HtmlPurifier } from '../../src/engines/word/index'

/**
 * Môi trường test cho Word Engine (TASK-07A): DOMPurify và
 * DOMParser cần một DOM — trong Node dùng jsdom (dev-only).
 * App thật chạy trên trình duyệt dùng instance/window thật;
 * đường code được kiểm là MỘT.
 */

const jsdomWindow = new JSDOM('').window

export const testPurifier: HtmlPurifier = (
  DOMPurify as unknown as (window: unknown) => HtmlPurifier
)(jsdomWindow)

export function createTestConvertOptions(): ConvertDocxOptions {
  return {
    purifier: testPurifier,
    domParser: new jsdomWindow.DOMParser(),
  }
}

export const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.slice().buffer as ArrayBuffer
