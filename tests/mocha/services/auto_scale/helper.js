'use strict';

const chai = require('chai'),
  assert = chai.assert;

const rootPrefix = '../../../..',
  logger = require(rootPrefix + '/lib/logger/customConsoleLogger'),
  testConstants = require(rootPrefix + '/tests/mocha/services/constants'),
  autoScaleHelper = require(rootPrefix + '/lib/autoScale/helper');

/**
 * Constructor for helper class
 *
 * @constructor
 */
const helper = function() {};

helper.prototype = {
  /**
   * To wait till response
   * @param dynamoDbApiObject
   * @param func
   * @param params
   * @param toAssert
   * @param retries
   * @return {Promise<void>}
   */
  waitTillTableStatusProvided: async function(dynamoDbApiObject, func, params, toAssert, retries) {
    const oThis = this,
      WAIT = retries ? retries : 30;
    let count = WAIT;
    let response = null;
    while (count > 0) {
      response = await oThis.waitTillResponse(dynamoDbApiObject, func, params);

      assert.isTrue(response.isSuccess(), 'Get status table failed');

      if (response.data.status === toAssert) {
        return response;
      }
      count -= 1;
    }
    return response;
  },

  /**
   * wait till response
   * @param dynamodbApiObject
   * @param func
   * @param params
   * @return {Promise<any>}
   */
  waitTillResponse: async function(dynamodbApiObject, func, params) {
    return new Promise(function(resolve) {
      setTimeout(async function() {
        let response = await func.call(dynamodbApiObject, params);
        resolve(response);
      }, 5000);
    });
  },

  /**
   * Delete Table Helper method
   *
   * @params {object} dynamodbApiObject - DynamoDB Api object
   * @params {object} params - batch get params
   * @params {object} isResultSuccess - expected result
   *
   * @return {result}
   *
   */
  deleteTable: async function(dynamodbApiObject, params, isResultSuccess) {
    const deleteTableResponse = await dynamodbApiObject.deleteTable(params);

    if (isResultSuccess === true) {
      assert.equal(deleteTableResponse.isSuccess(), true);
      logger.debug('deleteTableResponse.data.TableDescription', deleteTableResponse.data.TableDescription);
      assert.exists(deleteTableResponse.data.TableDescription, params.TableName);
    } else {
      assert.equal(deleteTableResponse.isSuccess(), false);
    }

    return deleteTableResponse;
  },

  /**
   * Create Table Helper method
   *
   * @params {object} dynamodbApiObject - DynamoDB Api object
   * @params {object} params - batch get params
   * @params {object} isResultSuccess - expected result
   *
   * @return {result}
   *
   */
  createTable: async function(dynamodbApiObject, params, isResultSuccess) {
    const createTableResponse = await dynamodbApiObject.createTable(params);

    if (isResultSuccess) {
      assert.equal(createTableResponse.isSuccess(), true);
      assert.exists(createTableResponse.data.TableDescription, params.TableName);
    } else {
      assert.equal(createTableResponse.isSuccess(), false, 'createTable: successfull, should fail for this case');
    }
    return createTableResponse;
  },

  /**
   * Wait for table to get deleted
   *
   * @param dynamodbApiObject
   * @param params
   */
  waitForTableToGetDeleted: async function(dynamodbApiObject, params) {
    const oThis = this;
    const response = await dynamodbApiObject.tableNotExistsUsingWaitFor(params);

    assert.isTrue(response.isSuccess(), 'tableNotExists failed');
  },

  /**
   * Wait for table to get created
   *
   * @param dynamodbApiObject
   * @param params
   */
  waitForTableToGetCreated: async function(dynamodbApiObject, params) {
    const oThis = this;
    const response = await dynamodbApiObject.tableExistsUsingWaitFor(params);

    assert.isTrue(response.isSuccess(), 'tableExists failed');
  },

  /**
   * Delete Scaling Policy
   *
   * @param autoScaleObject
   * @param params
   * @return {Promise<void>}
   */
  deleteScalingPolicy: async function(autoScaleObject, params) {
    const oThis = this;
    const response = await autoScaleObject.deleteScalingPolicy(params);

    assert.isTrue(response.isSuccess(), 'deleteScalingPolicy failed');
  },

  /**
   * De Register Scalable Target
   *
   * @param autoScaleObject
   * @param params
   * @return {Promise<void>}
   */
  deregisterScalableTarget: async function(autoScaleObject, params) {
    const oThis = this;
    const response = await autoScaleObject.deregisterScalableTarget(params);

    assert.isTrue(response.isSuccess(), 'deregisterScalableTarget failed');
  },

  /**
   * Create test case env
   *
   * @return {Promise<void>}
   */
  createTestCaseEnvironment: async function(dynamodbApiObject, autoScaleObj) {
    const oThis = this,
      params = {
        TableName: testConstants.dummyTestTableName
      };

    const checkTableExistsResponse1 = await dynamodbApiObject.checkTableExist(params);

    if (checkTableExistsResponse1.data.response === true) {
      logger.log(testConstants.dummyTestTableName, 'Table exists . Deleting it....');
      await oThis.deleteTable(dynamodbApiObject, params, true);

      logger.info('Waiting for table to get deleted');
      await oThis.waitForTableToGetDeleted(dynamodbApiObject, params);
      logger.info('Table got deleted');
    } else {
      logger.log(testConstants.dummyTestTableName, 'Table does not exist.');
    }

    logger.info('Creating table');
    const createTableResponse = await oThis.createTable(dynamodbApiObject, oThis.getCreateTableParams(), true);

    const roleARN = createTableResponse.data.TableDescription.TableArn;
    logger.log('Table arn :', roleARN);

    logger.info('Waiting for table to get created.............');
    await oThis.waitForTableToGetCreated(dynamodbApiObject, params);

    logger.info('Table is active');

    return { role_arn: roleARN };
  },

  cleanTestCaseEnvironment: async function(dynamodbApiObject, autoScaleObj) {
    const oThis = this,
      params = {
        TableName: testConstants.dummyTestTableName
      };

    const deleteTableResponse = await oThis.deleteTable(dynamodbApiObject, params, true);
    if (deleteTableResponse.isFailure()) {
      assert.fail('Not able to delete table');
    }

    logger.log('Waiting for Table get deleted...............');
    await oThis.waitForTableToGetDeleted(dynamodbApiObject, params);

    logger.log('Table got deleted');
  },

  /**
   * Create table migration
   * @param dynamodbApiObject
   * @param autoScaleObj
   * @return {Promise<*|Promise<*>|promise<result>>}
   */
  createTableMigration: async function(dynamodbApiObject, autoScaleObj) {
    const oThis = this,
      params = {},
      tableName = testConstants.dummyTestTableName,
      resourceId = autoScaleHelper.createResourceId(testConstants.dummyTestTableName);

    params.createTableConfig = oThis.getCreateTableParams(testConstants.dummyTestTableName);

    params.updateContinuousBackupConfig = {
      PointInTimeRecoverySpecification: {
        /* required */
        PointInTimeRecoveryEnabled: true || false /* required */
      },
      TableName: testConstants.dummyTestTableName /* required */
    };

    const autoScalingConfig = {},
      gsiArray = params.createTableConfig.GlobalSecondaryIndexes || [];

    autoScalingConfig.registerScalableTargetWrite = autoScaleHelper.createScalableTargetParams(
      resourceId,
      autoScaleHelper.writeCapacityScalableDimension,
      1,
      50
    );

    autoScalingConfig.registerScalableTargetRead = autoScaleHelper.createScalableTargetParams(
      resourceId,
      autoScaleHelper.readCapacityScalableDimension,
      1,
      50
    );

    autoScalingConfig.putScalingPolicyWrite = autoScaleHelper.createPolicyParams(
      tableName,
      resourceId,
      autoScaleHelper.writeCapacityScalableDimension,
      autoScaleHelper.writeMetricType,
      1,
      1,
      50.0
    );

    autoScalingConfig.putScalingPolicyRead = autoScaleHelper.createPolicyParams(
      tableName,
      resourceId,
      autoScaleHelper.readCapacityScalableDimension,
      autoScaleHelper.readMetricType,
      1,
      1,
      50.0
    );

    autoScalingConfig.globalSecondaryIndex = {};

    for (let index = 0; index < gsiArray.length; index++) {
      let gsiIndexName = gsiArray[index].IndexName,
        indexResourceId = autoScaleHelper.createIndexResourceId(tableName, gsiIndexName);

      autoScalingConfig.globalSecondaryIndex[gsiIndexName] = {};

      autoScalingConfig.globalSecondaryIndex[
        gsiIndexName
      ].registerScalableTargetWrite = autoScaleHelper.createScalableTargetParams(
        indexResourceId,
        autoScaleHelper.indexWriteCapacityScalableDimenstion,
        1,
        20
      );

      autoScalingConfig.globalSecondaryIndex[
        gsiIndexName
      ].registerScalableTargetRead = autoScaleHelper.createScalableTargetParams(
        indexResourceId,
        autoScaleHelper.indexReadCapacityScalableDimension,
        1,
        20
      );

      autoScalingConfig.globalSecondaryIndex[gsiIndexName].putScalingPolicyWrite = autoScaleHelper.createPolicyParams(
        tableName,
        indexResourceId,
        autoScaleHelper.indexWriteCapacityScalableDimenstion,
        autoScaleHelper.writeMetricType,
        1,
        1,
        70.0
      );

      autoScalingConfig.globalSecondaryIndex[gsiIndexName].putScalingPolicyRead = autoScaleHelper.createPolicyParams(
        tableName,
        indexResourceId,
        autoScaleHelper.indexReadCapacityScalableDimension,
        autoScaleHelper.readMetricType,
        1,
        1,
        70.0
      );
    }

    params.autoScalingConfig = autoScalingConfig;
    return dynamodbApiObject.createTableMigration(autoScaleObj, params);
  },

  /**
   * Get crate table params
   *
   * @param tableName
   * @return {{TableName: *|string, KeySchema: *[], AttributeDefinitions: *[], ProvisionedThroughput: {ReadCapacityUnits: number, WriteCapacityUnits: number}, GlobalSecondaryIndexes: *[], SSESpecification: {Enabled: boolean}}}
   */
  getCreateTableParams: function(tableName) {
    tableName = tableName || testConstants.dummyTestTableName;
    return {
      TableName: tableName,
      KeySchema: [
        {
          AttributeName: 'tuid',
          KeyType: 'HASH'
        }, //Partition key
        {
          AttributeName: 'cid',
          KeyType: 'RANGE'
        } //Sort key
      ],
      AttributeDefinitions: [
        { AttributeName: 'tuid', AttributeType: 'S' },
        { AttributeName: 'cid', AttributeType: 'N' },
        { AttributeName: 'thash', AttributeType: 'S' }
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 1,
        WriteCapacityUnits: 1
      },
      GlobalSecondaryIndexes: [
        {
          IndexName: 'thash_global_secondary_index',
          KeySchema: [
            {
              AttributeName: 'thash',
              KeyType: 'HASH'
            }
          ],
          Projection: {
            ProjectionType: 'KEYS_ONLY'
          },
          ProvisionedThroughput: {
            ReadCapacityUnits: 1,
            WriteCapacityUnits: 1
          }
        }
      ],
      SSESpecification: {
        Enabled: false
      }
    };
  },

  /**
   * Get crate table params
   *
   * @param tableName
   * @return {{TableName: *|string, KeySchema: *[], AttributeDefinitions: *[], ProvisionedThroughput: {ReadCapacityUnits: number, WriteCapacityUnits: number}, GlobalSecondaryIndexes: *[], SSESpecification: {Enabled: boolean}}}
   */
  getCreateTableParamsWithoutSecondaryIndex: function(tableName) {
    tableName = tableName || testConstants.dummyTestTableName;
    return {
      TableName: tableName,
      KeySchema: [
        {
          AttributeName: 'tuid',
          KeyType: 'HASH'
        }, //Partition key
        {
          AttributeName: 'cid',
          KeyType: 'RANGE'
        } //Sort key
      ],
      AttributeDefinitions: [
        { AttributeName: 'tuid', AttributeType: 'S' },
        { AttributeName: 'cid', AttributeType: 'N' }
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 1,
        WriteCapacityUnits: 1
      },
      SSESpecification: {
        Enabled: false
      }
    };
  }
};

module.exports = new helper();
