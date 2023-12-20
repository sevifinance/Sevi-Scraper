const Tesseract = require('tesseract.js');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const filePath = path.resolve(__dirname, 'Captcha.png');

function download_captcha(page) {
  page.on('response', async (response) => {
    const url = response.url();
    if (response.request().resourceType() === 'image' && url.includes('GenerateCaptchaServlet.do')) {
      response.buffer().then((file) => {
        fs.writeFile(filePath, file, (err) => {
          if (err) {
            console.error('Error writing file:', err);
          } else {
          }
        });
      });
    }
  });
}

async function scrapData(page) {
  
  const TaxPayerTable = '//*[contains(text(), "Taxpayer Details")]/parent::*/following-sibling::*';
  const pinx = (await page.$x(`${TaxPayerTable}//*[text()="PIN"]/parent::*/following-sibling::*`))[0];
  const taxPayerNamex = (await page.$x(`${TaxPayerTable}//*[text()="Taxpayer Name"]/parent::*/following-sibling::*`))[0];
  const pinStatusx = (await page.$x(`${TaxPayerTable}//*[text()="PIN Status"]/parent::*/following-sibling::*`))[0];
  const iTaxStatusx = (await page.$x(`${TaxPayerTable}//*[text()="iTax Status"]/parent::*/following-sibling::*`))[0];
  if (!pinx) {
    process.exit(1);
  }
  const pin = await page.evaluate((e) => (e ? e.innerText : ''), pinx);
  const taxPayerName = await page.evaluate((e) => (e ? e.innerText : ''), taxPayerNamex);
  const pinStatus = await page.evaluate((e) => (e ? e.innerText : ''), pinStatusx);
  const iTaxStatus = await page.evaluate((e) => (e ? e.innerText : ''), iTaxStatusx);

  const ObligationRows = await page.$x('//*[contains(text(), "Obligation Details")]/parent::*/following-sibling::*/table/tbody/tr');
  const headers = await page.evaluate((e) => [...e.children].map((ch) => ch.innerText), ObligationRows[0]);
  const rowsData = [];
  for (let i = 1; i < ObligationRows.length; i++) {
    const row = await page.evaluate((e) => [...e.children].map((ch) => ch.innerText), ObligationRows[i]);
    const data = {};
    for (let j = 0; j < headers.length; j++) { data[headers[j]] = row[j]; }
    rowsData.push(data);
  }

  const data = {
    PIN: pin,
    Name: taxPayerName,
    StatusPin: pinStatus,
    StatusiTax: iTaxStatus,
    ObligationDetails: rowsData,
  };

  return data
}

export const startScrapingKRA = async (PIN: string, token?: string) => {
  console.log('PIN:', PIN)
  
  try {

    let browser

    if(token) {
      browser = await puppeteer.connect({ browserWSEndpoint: `wss://chrome.browserless.io?token=${token}` })
    } else {
      browser = await puppeteer.launch({ 
        headless: false,
        devtools: true
      });
    }

    console.log("launched browser")
    const page = await browser.newPage();
    page.goto('https://itax.kra.go.ke/KRA-Portal/pinChecker.htm');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    console.log("navDone")
    download_captcha(page);
    console.log("done")
    // await new Promise(r => setTimeout(r, 1500))
    console.log("set elements")
    // const element = (await page.$x('#vo.pinNo'))[0];
    // if (!element) {
    //   console.error('Failed to find element with ID "vo.pinNo"');
    //   return;
    // }

    // create function for field input value

    // const inputElement = await page.$("#vo.pinNo");

    // Fill the input element with the desired value
    await inputElement.type('1234567890');
    
    // await page.waitForSelector('#vo.pinNo');
    // await page.type('#vo\\.pinNo', 'your_value_here');

    // await page.$eval('#vo\\.pinNo', (input, value) => {
    //   input.value = value;
    // }, 'your_value_here');

    // await page.evaluate(() => {
    //   // @ts-ignore
    //   document.getElementById('vo.pinNo').value = 'your_value_here';
    // });

    // const pinInput = await page.querySelector('#vo.pinNo');
    // await page.evaluate((PIN) => {
    //   // @ts-ignore
    //   document.getElementById('vo.pinNo').value = PIN;
    // }, PIN);

    // await page.evaluate((PIN) => {
    //   // @ts-ignore
    //   document.getElementById('vo.pinNo').value = PIN;
    // }, PIN);

    // console.log("here")

    let wrongValue = false;
    do {
      let captcha_solution = '';
      let captchaText = '';
      do {
        // @ts-ignore
        await page.evaluate(() => ajaxCaptchaLoad());
        await new Promise(r => setTimeout(r, 500))
        try {
          captchaText = (await Tesseract.recognize(filePath)).data.text;
          captcha_solution = (eval(captchaText.trim().slice(0, -1).replace('?', ''))).toString();
        } catch (err) {
          captchaText = '';
        }

      } while (captchaText.trim() == '');

      await page.type('#captcahText', captcha_solution);
      await new Promise(r => setTimeout(r, 500))
      page.on('dialog', async (dialog) => {
        await dialog.dismiss();
        await browser.close();
        process.exit(1);
      });
      await page.click('#consult');
      await new Promise(r => setTimeout(r, 500))
      wrongValue = false;
      try {
        await page.waitForXPath('//*[contains(text(), "Wrong result of the arithmetic operation.")]', { timeout: 5000 });
        wrongValue = true;
      } catch (error) {
        wrongValue = false;
      }
    } while (wrongValue);
    const data = await scrapData(page);
    console.log('data:', data)
    await browser.close();
    return data
  } catch(err){
  }
};

startScrapingKRA('A006865771P')
