import { TaxPayerData } from "./types/return";

const Tesseract = require("tesseract.js");
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");
const filePath = path.resolve(__dirname, "Captcha.png");

function download_captcha(page: any) {
  page.on("response", async (response: any) => {
    const url = response.url();
    if (
      response.request().resourceType() === "image" &&
      url.includes("GenerateCaptchaServlet.do")
    ) {
      response.buffer().then((file: any) => {
        fs.writeFile(filePath, file, (err: any) => {
          if (err) {
            console.error("Error writing file:", err);
          } else {
          }
        });
      });
    }
  });
}

async function scrapData(page: any) {
  const TaxPayerTable =
    '//*[contains(text(), "Taxpayer Details")]/parent::*/following-sibling::*';
  const pinx = (
    await page.$x(
      `${TaxPayerTable}//*[text()="PIN"]/parent::*/following-sibling::*`
    )
  )[0];
  const taxPayerNamex = (
    await page.$x(
      `${TaxPayerTable}//*[text()="Taxpayer Name"]/parent::*/following-sibling::*`
    )
  )[0];
  const pinStatusx = (
    await page.$x(
      `${TaxPayerTable}//*[text()="PIN Status"]/parent::*/following-sibling::*`
    )
  )[0];
  const iTaxStatusx = (
    await page.$x(
      `${TaxPayerTable}//*[text()="iTax Status"]/parent::*/following-sibling::*`
    )
  )[0];
  if (!pinx) {
    process.exit(1);
  }
  const pin = await page.evaluate((e: any) => (e ? e.innerText : ""), pinx);
  const taxPayerName = await page.evaluate(
    (e: any) => (e ? e.innerText : ""),
    taxPayerNamex
  );
  const pinStatus = await page.evaluate(
    (e: any) => (e ? e.innerText : ""),
    pinStatusx
  );
  const iTaxStatus = await page.evaluate(
    (e: any) => (e ? e.innerText : ""),
    iTaxStatusx
  );

  const ObligationRows = await page.$x(
    '//*[contains(text(), "Obligation Details")]/parent::*/following-sibling::*/table/tbody/tr'
  );
  const headers = await page.evaluate(
    (e: any) => [...e.children].map((ch) => ch.innerText),
    ObligationRows[0]
  );
  const rowsData = [];
  for (let i = 1; i < ObligationRows.length; i++) {
    const row = await page.evaluate(
      (e: any) => [...e.children].map((ch) => ch.innerText),
      ObligationRows[i]
    );
    const data: { [key: string]: any } = {};
    for (let j = 0; j < headers.length; j++) {
      data[headers[j]] = row[j];
    }
    rowsData.push(data);
  }

  const data = {
    PIN: pin,
    Name: taxPayerName,
    StatusPin: pinStatus,
    StatusiTax: iTaxStatus,
    ObligationDetails: rowsData,
  };

  return data;
}

export const startScrapingKRA = async (PIN: string, token?: string): Promise<TaxPayerData> => {
  try {
    let browser: any = null

    if (token) {
      console.log("connecting to browserless");
      const browserWSEndpoint = `wss://chrome.browserless.io?token=${token}`
      console.log('browserWSEndpoint:', browserWSEndpoint)
      browser = await puppeteer.connect({
        browserWSEndpoint,
      });
    } else {
      browser = await puppeteer.launch({ 
        headless: "new",
        // devtools: true
      });
    }

    console.log("launched browser");
    const page = await browser.newPage();
    page.goto("https://itax.kra.go.ke/KRA-Portal/pinChecker.htm");
    await page.waitForNavigation({ waitUntil: "networkidle2" });
    download_captcha(page);
    await new Promise((r) => setTimeout(r, 2500));
    
    await page.waitForSelector('input[name="vo.pinNo"]');
    await page.focus('input[name="vo.pinNo"]');

    await page.evaluate((PIN: string) => {
      // @ts-ignore
      document.querySelector('input[name="vo.pinNo"]').value = PIN
    }, PIN);

    let wrongValue = false;
    do {
      let captcha_solution = "";
      let captchaText = "";
      do {
        // @ts-ignore
        await page.evaluate(() => ajaxCaptchaLoad());
        await new Promise((r) => setTimeout(r, 500));
        try {
          captchaText = (await Tesseract.recognize(filePath)).data.text;
          captcha_solution = eval(
            captchaText.trim().slice(0, -1).replace("?", "")
          ).toString();
        } catch (err) {
          captchaText = "";
        }
      } while (captchaText.trim() == "");

      await page.type("#captcahText", captcha_solution);
      await new Promise((r) => setTimeout(r, 500));
      page.on("dialog", async (dialog:any) => {
        await dialog.dismiss();
        await browser.close();
        process.exit(1);
      });
      await page.click("#consult");
      await new Promise((r) => setTimeout(r, 500));
      wrongValue = false;
      try {
        await page.waitForXPath(
          '//*[contains(text(), "Wrong result of the arithmetic operation.")]',
          { timeout: 5000 }
        );
        wrongValue = true;
      } catch (error) {
        wrongValue = false;
      }
    } while (wrongValue);
    const data = await scrapData(page);
    console.log("data:", data);
    await browser.close();
    return data;
  } catch (err) {}
};

// startScrapingKRA("A006865771P");
