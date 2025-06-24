import { scanDirectoryWithResult } from "../src/scanner";
import { join } from "path";
import { testfile1AbsPath, testfile3AbsPath, testfile4AbsPath, testfile5AbsPath, testfile6AbsPath } from "./test.base";
import { mapScanResultToReportVO } from "../src/file";

describe('scanner related test', () => {

  test('should not scan cycle import', () => {
    const result = scanDirectoryWithResult(join(__dirname, "./testproject2"))
    expect(result.haveCycle).toEqual(false)
  })

  test('should scan cycles in result', () => {
    const result = scanDirectoryWithResult(join(__dirname, "./testproject"))
    expect(result.haveCycle).toEqual(true)
    expect(result.cycleList?.[0]).toStrictEqual([
      testfile5AbsPath,
      testfile1AbsPath,
    ])
    expect(result.cycleList?.[1]).toStrictEqual([
      testfile3AbsPath,
      testfile4AbsPath,
      testfile6AbsPath,
    ])
  })

  it('should support scan all projects', () => {
    for (const proj of ['', 2, 3, 4, 5, 6, 7, 8]) {
      const projName = `testproject${proj}`
      const r = mapScanResultToReportVO(scanDirectoryWithResult(join(__dirname, `./${projName}`)))
      expect(r).toMatchSnapshot(`report for project ${projName}`)
    }
  });

  it('should not find cycles when importing a non-relative module with the same name as the file', () => {
    const result = scanDirectoryWithResult(join(__dirname, `./testproject9`));
    expect(result.haveCycle).toBe(false);
  });

  it('should not have false positives on .d.ts files', () => {
    const result = scanDirectoryWithResult(join(__dirname, `./testproject10`));
    expect(result.haveCycle).toBe(false);
  });

  it('should respect ignoring on the relative path', () => {
    const result = scanDirectoryWithResult(join(__dirname, `./testproject11`), {
      ignoreRegex: /^cycle/
    });
    expect(result.haveCycle).toBe(false);
  });

  it('should report a cycle if at least one file is not ignored', () => {
    const result = scanDirectoryWithResult(join(__dirname, `./testproject11`), {
      ignoreRegex: /cycle\/1/
    });
    expect(result.haveCycle).toBe(true);
    expect(result.cycleList?.length).toBeGreaterThan(0);
  });
})
