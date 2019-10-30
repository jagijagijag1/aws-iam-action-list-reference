// transform iam data in Netflix-Skunkworks/policyuniverse to original format
// (https://github.com/Netflix-Skunkworks/policyuniverse/blob/master/policyuniverse/data.json)
// expected that the data file exists on the path `dataJsonPath`
const fs = require('fs');

const dataJsonPath = './extracted/Netflix-Skunkworks-policyuniverse-data.json'
const policyuniversData = JSON.parse(fs.readFileSync(dataJsonPath, 'utf8'));
const outFile = './extracted/aws-iam-action-list-from-policyuniverse.json';
var transformed = []

console.log()
for (service in policyuniversData) {
  // create service node in transformed
  serviceNode = {
    ServiceName: service,
    AccessLevels: []
  }

  prefix = policyuniversData[service]['prefix']
  actions = policyuniversData[service]['actions']
  for (action in actions) {
    actionType = actions[action]['calculated_action_group']
    // console.log(prefix + ':' + actionType + ':' + action)

    if (!serviceNode.AccessLevels.some(item => item.AccessLevel === actionType)) {
      // if ActionLevels contains no 'actionType', push the type(level)
      serviceNode.AccessLevels.push({
        "AccessLevel": actionType,
        "Actions": []
      })
    }

    // set action
    fulActionName = prefix + '::' + action
    var actionOjb = {
      "ActionName": action,
      "FullActionName": fulActionName
    }
    serviceNode.AccessLevels.filter(item => item.AccessLevel === actionType)[0].Actions.push(actionOjb);
  }
  transformed.push(serviceNode)
}

fs.writeFile(outFile, JSON.stringify(transformed, null, 2), (err) => {
    if (err) {
        console.error(err);
        return;
    };
    console.log("File has been created");
});