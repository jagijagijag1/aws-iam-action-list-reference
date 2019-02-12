const HCCrawler = require('headless-chrome-crawler');
const fs = require('fs');
const levenshtein = require('js-levenshtein');

const rootUrl = 'https://docs.aws.amazon.com/ja_jp/IAM/latest/UserGuide/reference_policies_actions-resources-contextkeys.html'
const outFile = './aws-iam-action-list-reference.json';

const serviceNamespace = JSON.parse(fs.readFileSync('./aws-service-namespace.json', 'utf8')).result;
function convertServiceName(original) {
  var min = Number.MAX_VALUE;
  var res = '';
  serviceNamespace.forEach(elm => {
    var tmp = levenshtein(original, elm.Service);
    if (tmp < min) {
      res = elm.NameSpace;
      min = tmp;
    }
  });

  return res;
}

function rewirteServiceName(allActions) {
  //const resultJSON = JSON.parse(fs.readFileSync('./aws-iam-action-list-reference.json', 'utf8')).result;

  allActions.forEach(elm => {
    var newSn = convertServiceName(elm.ServiceName);
    elm.ServiceName = newSn;

    elm.AccessLevels.forEach(act => {
      act.Actions.forEach(an => {
        an.FullActionName = newSn + '::' + an.ActionName;
      });
    });
  });

  console.log(allActions);

  fs.writeFile(outFile, JSON.stringify(allActions, null, 2), (err) => {
      if (err) {
          console.error(err);
          return;
      };
      console.log("File has been created");
  });
}

console.log('Crawling Start');

(async () => {
  var allActions = [];
  const crawler = await HCCrawler.launch({
    // filter pages not related to action list
    preRequest:  (options => {
      var re = new RegExp('.*docs.aws.amazon.com/ja_jp/IAM/latest/UserGuide/list_.*');
      if (options.url === rootUrl) return true;
      else if (!re.test(options.url)) return false;
      else return true;
    }),
    // Function to be evaluated in browsers
    evaluatePage: (() => {
      var topictitle = $('.topictitle').text();
      var sn = topictitle.substring(topictitle.indexOf('for') + 4).trim();

      var result = {
        ServiceName: sn,
        AccessLevels: []
      };
      
      $('.table-contents > table > tbody > tr').each(function(){
        // skip the row if it does not has 6 columns
        if ($(this).children().length != 6)
          return;

        var al = $(this).find('td').eq(2).text().trim();
        var act = $(this).find('td').eq(0).text().trim();
        //var fullact = sn + '::' + act;

        if (al === "" || act === "")
          return;

        // set access level
        if (!result.AccessLevels.some(item => item.AccessLevel === al)) {
          // if ActionLevels contains no access level 'ar', push the level
          result.AccessLevels.push({
            "AccessLevel": al,
            "Actions": []
          });
        }

        // set action
        var actojb = {
          "ActionName": act,
          //"FullActionName": fullact
        };
        result.AccessLevels.filter(item => item.AccessLevel === al)[0].Actions.push(actojb);
      });

      return result;
    }),
    // Function to be called with evaluated results from browsers
    onSuccess: (result => {
      if (result.result.AccessLevels.length != 0) {
        allActions.push(result.result);
        console.log(JSON.stringify(result.result, null, '  '));
        //console.log(result);
      }
    }),
    onError: (result => {
      console.log(result);
    }),
    retryCount: 0
  });

  // Queue a request
  await crawler.queue({
    url: rootUrl,
    maxDepth: 2
  });
  //await crawler.queue('https://docs.aws.amazon.com/ja_jp/IAM/latest/UserGuide/list_alexaforbusiness.html');

  await crawler.onIdle(); // Resolved when no queue is left
  await crawler.close(); // Close the crawler
  console.log('Crawling Done');

  console.log('Service Name Rewriting');
  rewirteServiceName(allActions)
})();
