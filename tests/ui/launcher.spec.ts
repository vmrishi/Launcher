import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Home.' })).toBeVisible();
});
test('all navigation pages render without runtime errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const name of [
    'General',
    'Shortcuts',
    'Donut toolbar',
    'Presets',
    'Applications',
    'Theme',
    'About',
    'Home',
  ]) {
    await page.getByRole('navigation').getByRole('button', { name, exact: true }).click();
    await expect(page.getByRole('heading', { name: `${name}.`, exact: true })).toBeVisible();
  }
  expect(errors).toEqual([]);
});
test('add, edit, search, persist and delete a website', async ({ page }) => {
  await page.getByRole('button', { name: 'Add application', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name', { exact: true }).fill('My docs');
  await dialog.getByLabel('Type', { exact: true }).selectOption('url');
  await dialog.getByLabel('Website address').fill('https://example.com/docs');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog).toBeHidden();
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'Applications', exact: true })
    .click();
  await page.getByLabel('Search applications').fill('My docs');
  await expect(page.getByRole('heading', { name: 'My docs', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit My docs', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Name', { exact: true }).fill('Team docs');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page.reload();
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'Applications', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Team docs', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit Team docs', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Delete Team docs?' })
    .getByRole('button', { name: 'Delete', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Team docs', exact: true })).toBeHidden();
});
test('launch groups preserve app order and configurable delays', async ({ page }) => {
  await page.getByRole('navigation').getByRole('button', { name: 'Presets', exact: true }).click();
  await page.getByRole('button', { name: 'New launch group' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name', { exact: true }).fill('Deep work');
  await dialog.getByLabel('Add application to group').selectOption({ label: 'Notepad' });
  await dialog.getByLabel('Add application to group').selectOption({ label: 'GitHub' });
  await dialog.getByLabel('Delay between applications').selectOption('1000');
  await dialog.getByRole('button', { name: 'Move GitHub up' }).click();
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('heading', { name: 'Deep work', exact: true })).toBeVisible();
  const data = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('orbit-launcher-preview-v1')!),
  );
  const group = data.entries.find((a: { name: string }) => a.name === 'Deep work');
  expect(group.delay).toBe(1000);
  expect(data.entries.find((a: { id: string }) => a.id === group.members[0]).name).toBe('GitHub');
  await page.getByRole('button', { name: 'Launch workspace' }).click();
  await expect(page.getByRole('status')).toContainText('Desktop preview');
});
test('donut profile editing, accessible add/remove and actual drag/drop persist', async ({
  page,
}) => {
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'Donut toolbar', exact: true })
    .click();
  await page.getByRole('button', { name: 'New profile', exact: true }).click();
  await page.getByLabel('Profile name').fill('Design');
  await page.getByLabel('Description').fill('My creative apps');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await page.getByRole('button', { name: 'Add Figma to donut', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit Figma', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Remove Figma from donut', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit Figma', exact: true })).toBeHidden();
  const transfer = await page.evaluateHandle(() => {
    const cfg = JSON.parse(localStorage.getItem('orbit-launcher-preview-v1')!);
    const dt = new DataTransfer();
    dt.setData(
      'application/orbit-entry',
      cfg.entries.find((a: { name: string }) => a.name === 'GitHub').id,
    );
    dt.setData('application/orbit-source', 'library');
    return dt;
  });
  await page.locator('.donut-preview').dispatchEvent('drop', { dataTransfer: transfer });
  await expect(page.getByRole('button', { name: 'Edit GitHub', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Icon only', exact: true }).click();
  await page.reload();
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'Donut toolbar', exact: true })
    .click();
  await expect(page.getByLabel('Active profile')).toHaveValue(/.+/);
  await expect(page.getByRole('button', { name: 'Icon only', exact: true })).toHaveClass(
    'selected',
  );
  await expect(page.getByRole('button', { name: 'Edit GitHub', exact: true })).toBeVisible();
});
test('theme, accent, material style and reduced motion survive reload', async ({ page }) => {
  await page.getByRole('navigation').getByRole('button', { name: 'Theme', exact: true }).click();
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await page.getByRole('button', { name: 'Sage accent' }).click();
  await page.getByRole('button', { name: /Material.*Tonal/ }).click();
  await page.getByRole('switch', { name: 'Reduce motion' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-style', 'material');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
  expect(
    await page
      .locator('html')
      .evaluate((el) => (el as HTMLElement).style.getPropertyValue('--accent')),
  ).toBe('#4a967c');
});
test('deleting a group member cleans up profiles and empty groups', async ({ page }) => {
  await page.getByRole('navigation').getByRole('button', { name: 'Presets', exact: true }).click();
  await page.getByRole('button', { name: 'New launch group' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Solo');
  await page.getByLabel('Add application to group').selectOption({ label: 'GitHub' });
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'Applications', exact: true })
    .click();
  await page.getByRole('button', { name: 'Edit GitHub', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Delete GitHub?' })
    .getByRole('button', { name: 'Delete', exact: true })
    .click();
  const data = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('orbit-launcher-preview-v1')!),
  );
  expect(data.entries.some((a: { name: string }) => ['Solo', 'GitHub'].includes(a.name))).toBe(
    false,
  );
  expect(
    data.profiles.every((p: { entries: string[] }) =>
      p.entries.every((id) => data.entries.some((a: { id: string }) => a.id === id)),
    ),
  ).toBe(true);
});
test('mobile layout remains usable without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await expect(page.getByRole('button', { name: 'Open launcher', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'Donut toolbar', exact: true })
    .click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('mouse drag reorders donut slices and removes a slice back to the palette', async ({
  page,
}) => {
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'Donut toolbar', exact: true })
    .click();
  const before = await page.evaluate(() => {
    const c = JSON.parse(localStorage.getItem('orbit-launcher-preview-v1')!);
    return c.profiles.find((p: { id: string }) => p.id === c.activeProfile).entries;
  });
  await page
    .getByRole('button', { name: 'Edit File Explorer', exact: true })
    .locator('.slice-label')
    .dragTo(page.getByRole('button', { name: 'Edit Notepad', exact: true }));
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const c = JSON.parse(localStorage.getItem('orbit-launcher-preview-v1')!);
        return c.profiles.find((p: { id: string }) => p.id === c.activeProfile).entries;
      }),
    )
    .not.toEqual(before);
  await page
    .getByRole('button', { name: 'Edit File Explorer', exact: true })
    .locator('.slice-label')
    .dragTo(page.locator('.palette'));
  await expect(page.getByRole('button', { name: 'Edit File Explorer', exact: true })).toBeHidden();
  await expect(
    page.getByRole('button', { name: 'Add File Explorer to donut', exact: true }),
  ).toBeVisible();
});

test('application editor accepts a dropped website link and traps focus', async ({ page }) => {
  await page.getByRole('button', { name: 'Add application', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const transfer = await page.evaluateHandle(() => {
    const dt = new DataTransfer();
    dt.setData('text/uri-list', 'https://example.org/project');
    return dt;
  });
  await dialog.locator('.editor-identity').dispatchEvent('drop', { dataTransfer: transfer });
  await expect(dialog.getByLabel('Website address')).toHaveValue('https://example.org/project');
  await dialog.getByLabel('Name', { exact: true }).fill('Dropped site');
  await dialog.getByRole('button', { name: 'Save changes' }).focus();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Close dialog', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Save changes' })).toBeFocused();
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('button', { name: 'Add application', exact: true })).toBeVisible();
});

test('shortcut recorder captures keys and independent font and slice settings persist', async ({
  page,
}) => {
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'Shortcuts', exact: true })
    .click();
  await page.getByRole('button', { name: 'Record keys', exact: true }).click();
  await page.keyboard.press('Control+Alt+L');
  await expect(page.locator('.shortcut-input input')).toHaveValue('Control+Alt+L');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await page.getByRole('navigation').getByRole('button', { name: 'Theme', exact: true }).click();
  await page.getByLabel('UI text size').fill('130');
  await page.getByLabel('UI text size').dispatchEvent('change');
  await page.getByLabel('Donut font size').fill('20');
  await page.getByLabel('Donut font size').dispatchEvent('change');
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'Donut toolbar', exact: true })
    .click();
  const before = await page.locator('.donut-slice path').first().getAttribute('d');
  await page.getByLabel('Slice corner radius').fill('12');
  await page.getByLabel('Slice corner radius').dispatchEvent('change');
  await expect
    .poll(() => page.locator('.donut-slice path').first().getAttribute('d'))
    .not.toBe(before);
  await page.reload();
  const c = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('orbit-launcher-preview-v1')!),
  );
  expect(c.settings).toMatchObject({
    uiFontScale: 130,
    donutFontSize: 20,
    sliceRadius: 12,
    hotkey: 'Control+Alt+L',
  });
});

test('floating donut has transparent HTML body and root surfaces', async ({ page }) => {
  await page.goto('/?donut=1');
  await expect(page.locator('.radial-window')).toBeVisible();
  expect(
    await page.evaluate(() =>
      [document.documentElement, document.body, document.getElementById('root')!].map(
        (el) => getComputedStyle(el).backgroundColor,
      ),
    ),
  ).toEqual(['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)']);
});
