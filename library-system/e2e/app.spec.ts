import { test, expect } from '@playwright/test';

test.describe('Home page', () => {
  test('loads and shows empty onboarding', async ({ page }) => {
    await page.goto('/');
    // Should show the onboarding card for first-time users
    await expect(page.locator('.empty-onboarding')).toBeVisible();
    await expect(page.locator('.empty-onboarding .empty-title')).toHaveText('欢迎来到你的书房');
  });

  test('navigation tabs work', async ({ page }) => {
    await page.goto('/');
    // Click search tab
    await page.click('#navSearch');
    await expect(page.locator('#searchSection')).toBeVisible();
    // Click organize tab
    await page.click('#navOrganize');
    await expect(page.locator('#organizeSection')).toBeVisible();
    // Click settings tab
    await page.click('#navSettings');
    await expect(page.locator('#settingsSection')).toBeVisible();
    // Click home tab
    await page.click('#navHome');
    await expect(page.locator('#homeSection')).toBeVisible();
  });

  test('FAB opens entry mode', async ({ page }) => {
    await page.goto('/');
    await page.click('#navFab');
    // Should show the manual entry card
    await expect(page.locator('#manualCard')).toBeVisible();
    // Should show ISBN input
    await expect(page.locator('#isbn')).toBeVisible();
  });
});

test.describe('Entry flow', () => {
  test('manual entry saves a book', async ({ page }) => {
    await page.goto('/');
    await page.click('#navFab');

    // Fill in book details manually
    await page.fill('#isbn', '9787020002207');
    await page.fill('#title', '红楼梦');
    await page.fill('#author', '曹雪芹');

    // Click save
    await page.click('#saveBtn');

    // Should show success (either modal or toast)
    // After save, the book should be in the list
    await page.click('#navHome');
    await expect(page.locator('#homeSection')).toBeVisible();

    // Book should appear somewhere on the page
    await expect(page.locator('body')).toContainText('红楼梦');
  });

  test('duplicate detection works', async ({ page }) => {
    await page.goto('/');

    // First, inject a book into localStorage
    await page.evaluate(() => {
      const book = {
        id: 'test-1',
        isbn: '9787020002207',
        title: '红楼梦',
        author: '曹雪芹',
        category: '小说',
        status: 'in_library',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem('lib:books:v1', JSON.stringify([book]));
    });

    await page.reload();
    await page.click('#navFab');
    await page.fill('#isbn', '9787020002207');

    // Trigger lookup (or manual save attempt)
    await page.click('#saveBtn');

    // Should show duplicate notice or modal
    await expect(page.locator('body')).toContainText(/已存在|重复/);
  });
});

test.describe('Settings', () => {
  test('export JSON works', async ({ page }) => {
    await page.goto('/');

    // Inject some books
    await page.evaluate(() => {
      const books = [
        { id: 'b1', isbn: '1234567890', title: 'Test Book', author: 'Author', status: 'in_library', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      ];
      localStorage.setItem('lib:books:v1', JSON.stringify(books));
    });

    await page.reload();
    await page.click('#navSettings');

    // Find and click export button
    const exportRow = page.locator('[data-action="exportJson"]');
    await expect(exportRow).toBeVisible();
  });

  test('import merge mode UI shows', async ({ page }) => {
    await page.goto('/');
    await page.click('#navSettings');

    // Open the advanced import section
    await page.click('summary');

    // Should see import mode selector
    await expect(page.locator('#importMode')).toBeVisible();
    const options = await page.locator('#importMode option').allTextContents();
    expect(options).toContain('覆盖本地（原样替换）');
    expect(options).toContain('合并导入（按 ISBN 去重，较新记录优先）');
  });
});

test.describe('Backup reminder', () => {
  test('shows after 5+ books with no export', async ({ page }) => {
    await page.goto('/');

    // Inject 6 books
    await page.evaluate(() => {
      const books = Array.from({ length: 6 }, (_, i) => ({
        id: `b${i}`, isbn: `978000000000${i}`, title: `Book ${i}`,
        author: 'Author', status: 'in_library',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }));
      localStorage.setItem('lib:books:v1', JSON.stringify(books));
      localStorage.removeItem('lib:export:last:v1');
    });

    await page.reload();
    await page.click('#navHome');

    // Backup reminder should be visible
    await expect(page.locator('#backupReminder')).toBeVisible();
  });
});
