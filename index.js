
const puppeteer = require('puppeteer');
const CREDS = require('./cred');
const mongoose = require('mongoose');
const User = require('./Models/user');


const USERNAME_SELECTOR = '#login_field';
const PASSWORD_SELECTOR = '#password';
const BUTTON_SELECTOR = '#login > form > div.auth-form-body.mt-3 > input.btn.btn-primary.btn-block';

const searchUrl = `https://github.com/search?q=location%3Asouth%2Bafrica+language%3Aphp&type=Users`;


const LIST_USERNAME_SELECTOR = '#user_search_results > div.user-list > div:nth-child(INDEX) > div.d-flex.flex-auto > div > a';
const LIST_EMAIL_SELECTOR = '#user_search_results > div.user-list > div:nth-child(INDEX) > div.d-flex.flex-auto > div > ul > li:nth-child(2) > a';

const LENGTH_SELECTOR_CLASS = 'user-list-item';

const DESCRIPTION_SELECTOR = '#js-pjax-container > div > div.h-card.col-3.float-left.pr-3 > div.p-note.user-profile-bio > div';
const NAME_SELECTOR = '#js-pjax-container > div > div.h-card.col-3.float-left.pr-3 > div.vcard-names-container.py-3.js-sticky.js-user-profile-sticky-fields > h1 > span.p-name.vcard-fullname.d-block.overflow-hidden';
const LOCATION_SELECTOR = '#js-pjax-container > div > div.h-card.col-3.float-left.pr-3 > ul > li:nth-child(2) > span';
const URL_SELECTOR = '#js-pjax-container > div > div.h-card.col-3.float-left.pr-3 > ul > li:nth-child(3) > a';
const REPOS_SELECTOR = '#js-pjax-container > div > div.col-9.float-left.pl-2 > div.UnderlineNav.user-profile-nav.js-sticky.top-0 > nav > a:nth-child(2) > span';
const STARS_SELECTOR = '#js-pjax-container > div > div.col-9.float-left.pl-2 > div.UnderlineNav.user-profile-nav.js-sticky.top-0 > nav > a:nth-child(3) > span';
const FOLLOWERS_SELECTOR = '#js-pjax-container > div > div.col-9.float-left.pl-2 > div.UnderlineNav.user-profile-nav.js-sticky.top-0 > nav > a:nth-child(4) > span';
const FOLLOWING_SELECTOR = '#js-pjax-container > div > div.col-9.float-left.pl-2 > div.UnderlineNav.user-profile-nav.js-sticky.top-0 > nav > a:nth-child(5) > span';
const ORGANISATION_SELECTOR = '#js-pjax-container > div > div.h-card.col-3.float-left.pr-3 > div.border-top.py-3.clearfix > a > img';
const START_YEAR = '#year-list-container > div.profile-timeline-year-list.js-profile-timeline-year-list.bg-white.js-sticky > ul > li:last-child a';

async function run() {

    const browser = await puppeteer.launch({
        headless: false
    });

    const page = await browser.newPage();

    await page.goto('https://github.com/login');

    await page.click(USERNAME_SELECTOR);
    await page.keyboard.type(CREDS.username);

    await page.click(PASSWORD_SELECTOR);
    await page.keyboard.type(CREDS.password);

    await page.click(BUTTON_SELECTOR);

    await page.waitForNavigation();


    await page.goto(searchUrl);
    await page.waitFor(2*1000);

    let numPages = await getNumPages(page);

    console.log('Numpages: ', numPages);

    for (let h = 1; h <= numPages; h++) {

        let pageUrl = searchUrl + '&p=' + h;
        await sleep(3000);

        await page.goto(pageUrl);

        let listLength = await page.evaluate((sel) => {
            return document.getElementsByClassName(sel).length;
        }, LENGTH_SELECTOR_CLASS);

        for (let i = 1; i <= listLength; i++) {

            // change the index to the next child
            let usernameSelector = LIST_USERNAME_SELECTOR.replace("INDEX", i);
            let emailSelector = LIST_EMAIL_SELECTOR.replace("INDEX", i);

            let username = await page.evaluate((sel) => {
                return document.querySelector(sel).getAttribute('href').replace('/', '');
            }, usernameSelector);

            let email = await page.evaluate((sel) => {
                let element = document.querySelector(sel);
                return element? element.innerHTML: null;
            }, emailSelector);

            // not all users have emails visible
            if (!email){
                console.log('Not email provided');
                continue;
            }

            let user = {};

            user.username = username;
            user.email = email;



            const tab = await browser.newPage();
            await tab.goto(`https://github.com/${username}`);
            await tab.waitFor(2*1000);

            user = await getDetails(tab, user);
            user.dateCrawled = new Date();

            console.log(user);

            await tab.close();

            upsertUser(user);
        }
    }

    browser.close();
}

async function getDetails(tab, user){

    user.name = await tab.evaluate((sel) => {
        let element = document.querySelector(sel);
        return element? element.innerHTML: null;
    }, NAME_SELECTOR);

    user.description = await tab.evaluate((sel) => {
        let element = document.querySelector(sel);
        return element? element.innerHTML: null;
    }, DESCRIPTION_SELECTOR);

    user.startYear = await tab.evaluate((sel) => {
        let element = document.querySelector(sel);
        return element? element.innerHTML.replace('\\n','').trim(): null;
    }, START_YEAR);

    user.location = await tab.evaluate((sel) => {
        let element = document.querySelector(sel);
        return element? element.innerHTML: null;
    }, LOCATION_SELECTOR);

    user.organisation = await tab.evaluate((sel) => {
        let element = document.querySelector(sel);
        return element? element.getAttribute('alt'): null;
    }, ORGANISATION_SELECTOR);

    user.url = await tab.evaluate((sel) => {
        let element = document.querySelector(sel);
        return element? element.innerHTML: null;
    }, URL_SELECTOR);

    user.repos = await tab.evaluate((sel) => {
        let element = document.querySelector(sel);
        return element? element.innerHTML.replace('\\n','').trim(): null;
    }, REPOS_SELECTOR);

    user.followers = await tab.evaluate((sel) => {
        let element = document.querySelector(sel);
        return element? element.innerHTML.replace('\\n','').trim(): null;
    }, FOLLOWERS_SELECTOR);

    user.following = await tab.evaluate((sel) => {
        let element = document.querySelector(sel);
        return element? element.innerHTML.replace('\\n','').trim(): null;
    }, FOLLOWING_SELECTOR);

    user.stars = await tab.evaluate((sel) => {
        let element = document.querySelector(sel);
        return element? element.innerHTML.replace('\\n','').trim(): null;
    }, STARS_SELECTOR);

    return user;
}

async function getNumPages(page) {


    const NUM_USER_SELECTOR = '#js-pjax-container > div > div.col-12.col-md-9.float-left.px-2.pt-3.pt-md-0.codesearch-results > div > div.d-flex.flex-column.flex-md-row.flex-justify-between.border-bottom.pb-3.position-relative > h3';

    let inner = await page.evaluate((sel) => {
        let html = document.querySelector(sel).innerHTML;

        // format is: "69,803 users"
        return html.replace(',', '').replace('users', '').trim();
    }, NUM_USER_SELECTOR);

    let numUsers = parseInt(inner);

    console.log('numUsers: ', numUsers);

    /*
    * GitHub shows 10 resuls per page, so
    */
    return Math.ceil(numUsers / 10);
}

function upsertUser(userObj) {

    const DB_URL = 'mongodb://localhost/scraper';

    if (mongoose.connection.readyState === 0) { mongoose.connect(DB_URL); }

    // if this email exists, update the entry, don't insert
    let conditions = { email: userObj.email };
    let options = { upsert: true, new: true, setDefaultsOnInsert: true };

    User.findOneAndUpdate(conditions, userObj, options, (err, result) => {
        if (err) throw err;
    });
}

async function sleep(ms){
    return new Promise(resolve => setTimeout(resolve, ms));
}

run();
