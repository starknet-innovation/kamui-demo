import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { FEATURES } from '../src/lib/features';

const SHOTS = '/workspace/kamui-work/screenshots';

test.beforeAll(() => {
  mkdirSync(SHOTS, { recursive: true });
});

test.describe.configure({ mode: 'serial' });

test('gallery loads and each feature section is visible', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Kamui, in full/i })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/00-hero.png`, fullPage: false });

  // Drive a few interactive playgrounds so screenshots show real SDK output.
  await page.locator('#social-login').getByRole('button', { name: /Run the SDK steps/ }).click();
  await expect(page.locator('#social-login .output')).toContainText('device public key');

  await page.locator('#pepper').getByRole('button', { name: /Export pepper file/ }).click();
  await expect(page.locator('#pepper .output')).toContainText('kamui-pepper');
  await page.locator('#pepper').getByRole('button', { name: /Parse and check/ }).click();
  await expect(page.locator('#pepper .output')).toContainText('parsePepperFile: ok');

  await page.locator('#address').getByRole('button', { name: /Compute identity and address/ }).click();
  await expect(page.locator('#address .output')).toContainText('identity');

  await page.locator('#sessions').getByRole('button', { name: /Validate with sessionProblems/ }).click();
  await expect(page.locator('#sessions .output').last()).toContainText('would show this session');

  await page.locator('#spending').getByRole('button', { name: /Run unlimitedTokenCalls/ }).click();
  await expect(page.locator('#spending .output')).toContainText('Uncovered token calls');

  await page.locator('#out-of-scope').getByRole('button', { name: /Ping-only session/ }).click();
  await expect(page.locator('#out-of-scope .output')).toContainText('sessionProblems: none');

  await page.locator('#execute').getByRole('button', { name: /Inspect approve 1.5 STRK/ }).click();
  await expect(page.locator('#execute .output')).toContainText('approve');

  await page.locator('#tokens').getByRole('button', { name: /^Describe$/ }).click();
  await expect(page.locator('#tokens .output')).toContainText('1.5 STRK');

  await page.locator('#owners').getByRole('button', { name: /Add a key/ }).click();
  await expect(page.locator('#owners .output')).toContainText('add_owner');

  await page.locator('#registry').getByRole('button', { name: /Hash a record/ }).click();
  await expect(page.locator('#registry .output')).toContainText('registryContentHash');

  await page.locator('#outside').getByRole('button', { name: /Build owner and session/ }).click();
  await expect(page.locator('#outside .output')).toContainText('execute_from_outside_v2');

  // Live Sepolia reads — do not fail the screenshot run if the public RPC is unhappy.
  await page.locator('#tokens').getByRole('button', { name: /Look up STRK/ }).click();
  await page.locator('#reader').getByRole('button', { name: /Read on Sepolia/ }).click();
  await page.waitForTimeout(2500);

  for (const feature of FEATURES) {
    const section = page.locator(`[data-section="${feature.id}"]`);
    await section.scrollIntoViewIfNeeded();
    await expect(section.getByRole('heading', { name: feature.title })).toBeVisible();
    await section.screenshot({ path: `${SHOTS}/${feature.id}.png` });
  }

  await page.screenshot({ path: `${SHOTS}/99-full-page.png`, fullPage: true });
});

test('demo keychain parses a connect request and shows sessionProblems', async ({ page }) => {
  await page.goto('/');
  await page.locator('#keychain').getByRole('button', { name: /Connect with Kamui/ }).click();
  await expect(page.getByRole('heading', { name: /Approve a session/ })).toBeVisible();
  await expect(page.getByText(/Demo keychain/)).toBeVisible();
  await expect(page.getByText(/ping\(\)/)).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/keychain-connect.png`, fullPage: true });
  await page.getByRole('button', { name: /Approve session/ }).click();
  await expect(page).toHaveURL(/#keychain/);
  await expect(page.locator('#keychain')).toContainText(/simulated|approved|Connected/i);
  await page.locator('#keychain').screenshot({ path: `${SHOTS}/keychain-connected.png` });
});
