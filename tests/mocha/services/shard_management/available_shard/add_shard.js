"use strict";

// Load external packages
const Chai = require('chai')
  , assert = Chai.assert
;

// Load dependencies package
const rootPrefix = "../../../../.."
  , DynamoDbObject = require(rootPrefix + "/index").Dynamodb
  , AutoScaleApiKlass = require(rootPrefix + "/index").AutoScaling
  , testConstants = require(rootPrefix + '/tests/mocha/services/constants')
  , logger = require(rootPrefix + "/lib/logger/custom_console_logger")
  , managedShardConst = require(rootPrefix + "/lib/global_constant/managed_shard")
  , availableShardConst = require(rootPrefix + "/lib/global_constant/available_shard")
  , helper = require(rootPrefix + "/tests/mocha/services/shard_management/helper")
;

const dynamoDbObject = new DynamoDbObject(testConstants.DYNAMODB_CONFIGURATIONS_REMOTE)
  , autoScaleObj = new AutoScaleApiKlass(testConstants.AUTO_SCALE_CONFIGURATIONS_REMOTE)
  , shardManagementObject = dynamoDbObject.shardManagement()
;

const createTestCasesForOptions = function (optionsDesc, options, toAssert) {
  optionsDesc = optionsDesc || "";
  options = options || {
    wrongEntityType: false,
    invalidSchema: false,
    corruptSchema: false
  };

  it(optionsDesc, async function () {
    this.timeout(1000000);
    let shardName = testConstants.shardTableName;
    let entity_type =  testConstants.shardEntityType;
    let schema = helper.createTableParamsFor("test");
    if (options.wrongEntityType) {
      entity_type = '';
    }
    if (options.invalidSchema) {
      schema = {};
    }
    const response = await shardManagementObject.addShard({shard_name: shardName ,entity_type: entity_type, table_schema: schema});
    logger.log("LOG", response);
    if (toAssert) {
      assert.isTrue(response.isSuccess(), "Success");
    } else {
      assert.isTrue(response.isFailure(), "Failure");
    }
  });

};

describe('services/shard_management/available_shard/add_shard', function () {
  before(async function () {
    this.timeout(1000000);

    let checkTableExistsResponse = await dynamoDbObject.checkTableExist({TableName: managedShardConst.getTableName()});
    if (checkTableExistsResponse.data.response === true) {
      await dynamoDbObject.deleteTable({
        TableName: managedShardConst.getTableName()
      });
    }

    checkTableExistsResponse = await dynamoDbObject.checkTableExist({TableName: availableShardConst.getTableName()});
    if (checkTableExistsResponse.data.response === true) {
      await dynamoDbObject.deleteTable({
        TableName: availableShardConst.getTableName()
      });
    }

    checkTableExistsResponse = await dynamoDbObject.checkTableExist({TableName: testConstants.shardTableName});
    if (checkTableExistsResponse.data.response === true) {
      await dynamoDbObject.deleteTable({
        TableName: testConstants.shardTableName
      });
    }

    await shardManagementObject.runShardMigration(dynamoDbObject, autoScaleObj);
  });

  createTestCasesForOptions("Shard adding happy case", {}, true);

  // createTestCasesForOptions("Shard adding empty shard name", {
  //   wrongEntityType: true
  // }, false);
  //
  // createTestCasesForOptions("Shard adding having invalid schema", {
  //   invalidSchema: true
  // }, false);
});