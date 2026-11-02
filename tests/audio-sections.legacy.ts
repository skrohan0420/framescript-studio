// Historical browser scenarios for the former UI. See tests/README.md.
import {test,expect} from '@playwright/test';
test('voice and sound have separate tabs and clip lists',async({page})=>{
 await page.route('**/api/recover',r=>r.fulfill({json:{result:null}}));await page.goto('/');await page.getByRole('button',{name:'Storyboard',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Storyboard & production workflow'});await dialog.getByRole('button',{name:'Voice',exact:true}).click();await expect(dialog.getByRole('heading',{name:'Voice generation',exact:true})).toBeVisible();await expect(dialog.getByRole('heading',{name:'SFX & background music',exact:true})).toBeHidden();await dialog.getByRole('button',{name:'SFX & Music',exact:true}).click();await expect(dialog.getByRole('heading',{name:'Voice generation',exact:true})).toBeHidden();await dialog.getByRole('button',{name:'Soft pop SFX',exact:true}).click();await expect(dialog.locator('.audio-clip')).toHaveCount(1);await dialog.getByRole('button',{name:'Voice',exact:true}).click();await expect(dialog.locator('.audio-clip')).toHaveCount(0);
});

test.beforeEach(async({page})=>{await page.route("**/api/workspaceGet",r=>r.fulfill({json:{result:null}}));});
