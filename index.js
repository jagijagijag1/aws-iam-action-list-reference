const HCCrawler = require('headless-chrome-crawler');
const fs = require('fs');
const levenshtein = require('js-levenshtein');

const root_url = 'https://docs.aws.amazon.com/ja_jp/IAM/latest/UserGuide/reference_policies_actions-resources-contextkeys.html'
const out_file = './aws-iam-action-list-reference.json';

const service_namespace = JSON.parse(fs.readFileSync('./aws-service-namespace.json', 'utf8')).result;
function convertServiceName(original) {
  var min = Number.MAX_VALUE;
  var res = '';
  service_namespace.forEach(elm => {
    var tmp = levenshtein(original, elm.Service);
    if (tmp < min) {
      res = elm.NameSpace;
      min = tmp;
    }
  });

  return res;
}

function rewirteServiceName(all_actions) {
  //const resultJSON = JSON.parse(fs.readFileSync('./aws-iam-action-list-reference.json', 'utf8')).result;

  all_actions.forEach(elm => {
    var new_sn = convertServiceName(elm.ServiceName);
    elm.ServiceName = new_sn;

    elm.AccessLevels.forEach(act => {
      act.Actions.forEach(an => {
        an.FullActionName = new_sn + '::' + an.ActionName;
      });
    });
  });

  console.log(all_actions);

  fs.writeFile(out_file, JSON.stringify(all_actions, null, 2), (err) => {
      if (err) {
          console.error(err);
          return;
      };
      console.log("File has been created");
  });
}

console.log('Crawling Start');

(async () => {
  var all_actions = [];
  const crawler = await HCCrawler.launch({
    // filter pages not related to action list
    preRequest:  (options => {
      var re = new RegExp('.*docs.aws.amazon.com/ja_jp/IAM/latest/UserGuide/list_.*');
      if (options.url === root_url) return true;
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
        all_actions.push(result.result);
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
    url: root_url,
    maxDepth: 2
  });
  //await crawler.queue('https://docs.aws.amazon.com/ja_jp/IAM/latest/UserGuide/list_alexaforbusiness.html');

  await crawler.onIdle(); // Resolved when no queue is left
  await crawler.close(); // Close the crawler
  console.log('Crawling Done');

  console.log('Service Name Rewriting');
  rewirteServiceName(all_actions)
})();
