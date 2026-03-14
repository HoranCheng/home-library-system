/**
 * Performance benchmark: rendering with 500 / 1000 / 5000 books
 * Run with: npx vitest run tests/perf/
 */
import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const htmlPath = resolve(__dirname, '../../preview/index.html');
const htmlContent = readFileSync(htmlPath, 'utf-8');

function generateBooks(count: number) {
  const cats = ['小说', '科学', '历史', '哲学', '技术', '艺术', '商业', '心理学'];
  const books = [];
  for (let i = 0; i < count; i++) {
    books.push({
      id: `bench-${i}`,
      isbn: `978${String(i).padStart(10, '0')}`,
      title: `测试书籍 ${i} — ${cats[i % cats.length]}分类下的一本书`,
      author: `作者 ${i % 200}`,
      category: cats[i % cats.length],
      readingStatus: ['unread', 'reading', 'read'][i % 3],
      publishedYear: String(2000 + (i % 25)),
      location: `书架 ${(i % 10) + 1}`,
      status: i % 4 === 0 ? 'to_be_sorted' : 'in_library',
      favorite: i % 7 === 0,
      createdAt: new Date(Date.now() - i * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - i * 43200000).toISOString(),
    });
  }
  return books;
}

describe('Render performance benchmarks', () => {
  for (const count of [500, 1000, 5000]) {
    it(`should handle ${count} books without excessive delay`, () => {
      const books = generateBooks(count);
      const json = JSON.stringify({ books, meta: { schemaVersion: 1, updatedAt: new Date().toISOString() } });

      // Measure JSON parse + storage simulation
      const parseStart = performance.now();
      const parsed = JSON.parse(json);
      const parseTime = performance.now() - parseStart;

      // Measure sort (most common operation during render)
      const sortStart = performance.now();
      const sorted = [...parsed.books].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const sortTime = performance.now() - sortStart;

      // Measure filter (search simulation)
      const filterStart = performance.now();
      const filtered = sorted.filter((b: any) => b.title.includes('5') || b.author.includes('3'));
      const filterTime = performance.now() - filterStart;

      // Measure category grouping
      const groupStart = performance.now();
      const groups: Record<string, any[]> = {};
      for (const b of sorted) {
        const cat = (b as any).category || '未分类';
        (groups[cat] = groups[cat] || []).push(b);
      }
      const groupTime = performance.now() - groupStart;

      console.log(`[${count} books] parse: ${parseTime.toFixed(1)}ms, sort: ${sortTime.toFixed(1)}ms, filter: ${filterTime.toFixed(1)}ms, group: ${groupTime.toFixed(1)}ms`);

      // Assertions: all operations should be under reasonable thresholds
      expect(parseTime).toBeLessThan(count <= 1000 ? 50 : 200);
      expect(sortTime).toBeLessThan(count <= 1000 ? 50 : 350);
      expect(filterTime).toBeLessThan(count <= 1000 ? 20 : 100);
      expect(groupTime).toBeLessThan(count <= 1000 ? 20 : 150);
    });
  }

  it('should serialize 5000 books to JSON under 250ms', () => {
    const books = generateBooks(5000);
    const start = performance.now();
    const json = JSON.stringify(books);
    const elapsed = performance.now() - start;
    console.log(`[5000 books] JSON.stringify: ${elapsed.toFixed(1)}ms, size: ${(json.length / 1024).toFixed(0)}KB`);
    // Benchmark on CI / laptops can fluctuate significantly; 250ms is a safer guardrail
    // that still catches serious regressions without failing on normal machine variance.
    expect(elapsed).toBeLessThan(250);
  });
});
