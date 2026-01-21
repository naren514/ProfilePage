import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
    await page.goto('/');

    // Expect a title "to contain" a substring.
    // We'll update this based on the actual title, for now let's check for something generic or just verify the page loads.
    // Since I don't know the exact title, I'll log the title and fail if it's empty, or just check that the page is attached.
    await expect(page).toHaveTitle(/Aham|Portfolio/i);
});
