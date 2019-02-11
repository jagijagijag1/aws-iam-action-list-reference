const HCCrawler = require('headless-chrome-crawler');
const JSONLineExporter = require('headless-chrome-crawler/exporter/json-line');

const FILE = './aws-service-namespace.json';
const exporter = new JSONLineExporter({
  file: FILE,
  fields: ['result'],
});

console.log('Crawling Start');

(async () => {
  const crawler = await HCCrawler.launch({
    exporter: exporter,
    // Function to be evaluated in browsers
    evaluatePage: (() => {
      var topictitle = $('.topictitle').text();
      var sn = topictitle.substring(topictitle.indexOf('for') + 4).trim();

      var result = []
      
      $('.table-contents > table > tbody > tr').each(function(){
        var s = $(this).find('td').eq(0).text().trim();
        var n = $(this).find('td').eq(1).text().trim();

        if (s === "" || n === "")
          return;

        result.push({ "Service": s, "NameSpace": n });
      });

      return result;
    }),
    // Function to be called with evaluated results from browsers
    onSuccess: (result => {
      console.log(result);
    }),
    onError: (result => {
      console.log(result);
    }),
    retryCount: 0
  });
  // Queue a request
  await crawler.queue('https://docs.aws.amazon.com/general/latest/gr/aws-arns-and-namespaces.html#genref-aws-service-namespaces');
  await crawler.onIdle(); // Resolved when no queue is left
  await crawler.close(); // Close the crawler
})();

await console.log('Crawling Done');
