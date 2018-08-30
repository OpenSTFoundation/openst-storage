'use strict';

/**
 * Available Shard Model
 *
 * @module models/dynamodb/shard_management/available_shard
 *
 */

const rootPrefix = '../../../..',
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  utils = require(rootPrefix + '/lib/utils');

require(rootPrefix + '/lib/dynamodb/base');
require(rootPrefix + '/config/core_constants');
require(rootPrefix + '/lib/global_constant/available_shard');
require(rootPrefix + '/lib/global_constant/managed_shard');
/**
 * Constructor Available Shard Model
 *
 * @constructor
 */
const AvailableShard = function() {};

AvailableShard.prototype = {
  getItem: function(ddbItem) {
    const oThis = this,
      ManagedShardItem = oThis.ic().getLibModelsAvailableShardItem();

    return new ManagedShardItem(ddbItem);
  },

  // For representation purpose
  columnNameMapping: function() {
    const oThis = this,
      availableShardConst = oThis.ic().getLibAvailableShard();
    return {
      [availableShardConst.SHARD_NAME]: 'shard_name',
      [availableShardConst.ENTITY_TYPE]: 'entity_type',
      [availableShardConst.ALLOCATION_TYPE]: 'allocation_type',
      [availableShardConst.CREATED_AT]: 'created_at',
      [availableShardConst.UPDATED_AT]: 'updated_at'
    };
  },

  invertedColumnNameMapping: function() {
    const oThis = this;
    return utils.invert(oThis.columnNameMapping());
  },

  /**
   * Run add shard
   *
   * @params {Object} params - Parameters
   * @param {String} params.shard_name - shard name
   * @param {String} params.entity_type - entity type of shard
   *
   * @return {Promise<any>}
   *
   */
  addShard: function(params) {
    const oThis = this,
      ddbObject = oThis.ic().getLibDynamoDBBase(),
      shardName = params.shard_name,
      entityType = params.entity_type;

    return new Promise(async function(onResolve) {
      try {
        logger.debug('=======AddShard.addShard.addShardTableEntry=======');
        const addShardEntryResponse = await oThis.addShardTableEntry(ddbObject, shardName, entityType);
        logger.debug(addShardEntryResponse);
        if (addShardEntryResponse.isFailure()) return addShardEntryResponse;

        return onResolve(responseHelper.successWithData({}));
      } catch (err) {
        return onResolve(responseHelper.error('s_sm_as_as_addShard_1', 'Error adding shard. ' + err));
      }
    });
  },

  /**
   * To add Shard table entry in available shard table
   *
   * @param {Object} ddbObject - dynamo db object
   * @param {String} shardTableName - shard table name
   * @param {String} entityType - entity type
   *
   * // By default allocation is disabled so that in run time allocation doesn't happen i.e data doesn't get polluted
   */
  addShardTableEntry: function(ddbObject, shardTableName, entityType) {
    const oThis = this,
      dateTime = String(new Date().getTime()),
      availableShardConst = oThis.ic().getLibAvailableShard(),
      insertItemParams = {
        TableName: availableShardConst.getTableName(),
        Item: {
          [availableShardConst.SHARD_NAME]: { S: shardTableName },
          [availableShardConst.ENTITY_TYPE]: { S: entityType },
          [availableShardConst.ALLOCATION_TYPE]: {
            N: String(availableShardConst.getShardTypes()[availableShardConst.disabled])
          },
          [availableShardConst.CREATED_AT]: { N: dateTime },
          [availableShardConst.UPDATED_AT]: { N: dateTime }
        }
      };

    return ddbObject.queryDdb('putItem', 'dax', insertItemParams);
  },

  /**
   * Run configure shard based on shard name and allocation type
   *
   * @params {Object} params - Parameters
   * @param {String} params.shard_name - Name of the shard
   * @param {String} params.allocation_type - allocation_type string
   *
   * @return {Promise<any>}
   *
   */
  configureShard: function(params) {
    const oThis = this,
      ddbObject = oThis.ic().getLibDynamoDBBase(),
      shardName = params.shard_name,
      availableShardConst = oThis.ic().getLibAvailableShard(),
      allocationType = params.allocation_type,
      updateItemParam = {
        TableName: availableShardConst.getTableName(),
        Key: {
          [availableShardConst.SHARD_NAME]: {
            S: shardName
          }
        },
        ExpressionAttributeNames: {
          '#alloc': availableShardConst.ALLOCATION_TYPE,
          '#updatedAt': availableShardConst.UPDATED_AT
        },
        ExpressionAttributeValues: {
          ':t': {
            N: String(availableShardConst.ALLOCATION_TYPES[String(allocationType)])
          },
          ':u': {
            N: String(new Date().getTime())
          }
        },
        ReturnValues: 'ALL_NEW',
        UpdateExpression: 'SET #alloc = :t, #updatedAt = :u'
      };
    // logger.log('DEBUG', JSON.stringify(updateItemParam));
    return ddbObject.queryDdb('updateItem', 'dax', updateItemParam);
  },

  /**
   * Get shard info by Name
   *
   * @params {Object} params - Parameters
   * @param {String} params.shard_name - Name of the shard
   *
   * @return {Promise<any>}
   *
   */
  getShardByName: async function(params) {
    const oThis = this,
      ddbObject = oThis.ic().getLibDynamoDBBase(),
      shardName = params.shard_name,
      availableShardConst = oThis.ic().getLibAvailableShard(),
      queryParams = {
        TableName: availableShardConst.getTableName(),
        ExpressionAttributeValues: {
          ':val': {
            S: String(shardName)
          }
        },
        KeyConditionExpression: '#sn = :val',
        ExpressionAttributeNames: {
          '#sn': availableShardConst.SHARD_NAME,
          '#et': availableShardConst.ENTITY_TYPE,
          '#al': availableShardConst.ALLOCATION_TYPE,
          '#ca': availableShardConst.CREATED_AT,
          '#ua': availableShardConst.UPDATED_AT
        },
        ProjectionExpression: '#sn, #et, #al, #ca, #ua',
        ConsistentRead: true
      };
    const response = await ddbObject.queryDdb('query', 'dax', queryParams);

    if (response.isSuccess() && response.data.Items[0]) {
      let item = oThis.getItem(response.data.Items[0]);
      return responseHelper.successWithData({
        [item.shardName]: {
          [availableShardConst.ENTITY_TYPE]: item.entityType,
          [availableShardConst.ALLOCATION_TYPE]: item.allocationType
        }
      });
    } else {
      return response;
    }
  },

  /**
   * Determine shard name exist or not.
   *
   * @params {Object} params - Parameters
   * @param {String} params.shard_names - Name of the shard
   *
   * @return {Promise<any>}
   *
   */
  hasShard: async function(params) {
    const oThis = this,
      ddbObject = oThis.ic().getLibDynamoDBBase(),
      shardNames = params.shard_names,
      dataResponse = {},
      keys = [],
      queryParams = { RequestItems: {} },
      coreConstants = oThis.ic().getCoreConstants(),
      availableShardConst = oThis.ic().getLibAvailableShard();
    try {
      for (let ind = 0; ind < shardNames.length; ind++) {
        keys.push({
          [availableShardConst.SHARD_NAME]: {
            S: String(shardNames[ind])
          }
        });
        dataResponse[shardNames[ind]] = { has_shard: false };
      }

      queryParams.RequestItems[availableShardConst.getTableName()] = { Keys: keys, ConsistentRead: true };

      const response = await ddbObject.queryDdb('batchGetItem', 'dax', queryParams);

      if (response.isFailure()) {
        return response;
      }
      const responseArray = response.data.Responses[availableShardConst.getTableName()];

      for (let ind = 0; ind < responseArray.length; ind++) {
        let AvailableShardItem = oThis.getItem(responseArray[ind]);
        dataResponse[AvailableShardItem.shardName] = { has_shard: true };
      }
    } catch (err) {
      logger.error('error in available_shards :: hasShard ', err);
      return responseHelper.error({
        internal_error_identifier: 'l_m_as_hasShard_1',
        api_error_identifier: 'exception',
        debug_options: { error: err },
        error_config: coreConstants.ERROR_CONFIG
      });
    }

    return responseHelper.successWithData(dataResponse);
  },

  /**
   * Run get shards
   *
   * @param {Array} params.ids - ids containing entity type and shard type
   * @param {String} params.ids.entity_type - get entity type
   * @param {Object} params.id_value_map - id to hash map
   * @param {String} params.ids.shard_type - get shard type Example :- 'all', 'enabled', 'disabled' (Default 'All')
   *
   * @return {Promise<any>}
   *
   */
  getShardsByEntityAllocation: async function(params) {
    const oThis = this,
      ddbObject = oThis.ic().getLibDynamoDBBase(),
      ids = params.ids,
      idToValueMap = params.id_value_map,
      promiseArray = [],
      dataResponse = {},
      coreConstants = oThis.ic().getCoreConstants(),
      availableShardConst = oThis.ic().getLibAvailableShard();

    try {
      for (let ind = 0; ind < ids.length; ind++) {
        let objectKey = ids[ind];
        let object = idToValueMap[objectKey];

        let keyConditionExpression = '#et = :val1',
          expressionAttributeExpression = {
            '#et': availableShardConst.ENTITY_TYPE,
            '#sn': availableShardConst.SHARD_NAME,
            '#al': availableShardConst.ALLOCATION_TYPE,
            '#ca': availableShardConst.CREATED_AT,
            '#ua': availableShardConst.UPDATED_AT
          },
          projectionExpression = '#sn, #et, #ca, #ua, #al',
          shardTypeCode = availableShardConst.getShardTypes()[object.shard_type],
          expressionAttributeValues = {
            ':val1': {
              S: String(object.entity_type)
            }
          };

        if (object.shard_type !== availableShardConst.all) {
          expressionAttributeValues[':val2'] = {
            N: String(shardTypeCode)
          };
          keyConditionExpression = keyConditionExpression + ' AND #al = :val2';
          expressionAttributeExpression['#al'] = availableShardConst.ALLOCATION_TYPE;
        }

        let queryParams = {
          TableName: availableShardConst.getTableName(),
          IndexName: availableShardConst.getIndexNameByEntityAllocationType(),
          ExpressionAttributeValues: expressionAttributeValues,
          KeyConditionExpression: keyConditionExpression,
          ExpressionAttributeNames: expressionAttributeExpression,
          ProjectionExpression: projectionExpression
        };

        promiseArray.push(ddbObject.queryDdb('query', 'dax', queryParams));
      }

      const responseArray = await Promise.all(promiseArray);

      for (let ind = 0; ind < responseArray.length; ind++) {
        let resp = responseArray[ind];
        if (resp.isSuccess()) {
          const itemArray = [];
          for (let pointer = 0; pointer < resp.data.Items.length; pointer++) {
            let itemObject = oThis.getItem(resp.data.Items[pointer]);
            itemArray.push(itemObject);
          }
          dataResponse[ids[ind]] = itemArray;
        }
      }
    } catch (err) {
      logger.error('error in available_shards :: getShardsByEntityAllocation ', err);
      return responseHelper.error({
        internal_error_identifier: 'l_m_as_getShardsByEntityAllocation_1',
        api_error_identifier: 'exception',
        debug_options: { error: err },
        error_config: coreConstants.ERROR_CONFIG
      });
    }

    return responseHelper.successWithData(dataResponse);
  }
};

/**
 * Entity class to hold data of available shard
 * @param paramDdbItem dynamo db item
 * @constructor AvailableShardItemKlass
 */
const AvailableShardItemKlass = function(paramDdbItem) {
  const oThis = this,
    ddbItem = paramDdbItem,
    availableShardConst = oThis.ic().getLibAvailableShard(),
    defineProperty = function(oThis, propertyName, returnValue) {
      Object.defineProperty(oThis, propertyName, {
        get: function() {
          return returnValue;
        },
        enumerable: true
      });
    };

  defineProperty(oThis, 'shardName', ddbItem[availableShardConst.SHARD_NAME]['S']);

  defineProperty(oThis, 'entityType', ddbItem[availableShardConst.ENTITY_TYPE]['S']);

  defineProperty(
    oThis,
    'allocationType',
    availableShardConst.getInverseShardTypes()[ddbItem[availableShardConst.ALLOCATION_TYPE]['N']]
  );

  defineProperty(oThis, 'createdAt', ddbItem[availableShardConst.CREATED_AT]['N']);

  defineProperty(oThis, 'updatedAt', ddbItem[availableShardConst.UPDATED_AT]['N']);
};

AvailableShardItemKlass.prototype.constructor = AvailableShardItemKlass;

InstanceComposer.registerShadowableClass(AvailableShardItemKlass, 'getLibModelsAvailableShardItem');

InstanceComposer.register(AvailableShard, 'getDDBServiceAvailableShard', true);

module.exports = AvailableShard;