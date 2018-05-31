const rootPrefix = '../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , coreConstants = require(rootPrefix + '/config/core_constants')
  , BigNumber = require('bignumber.js')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
;

/**
 * Base Model Constructor
 *
 * @constructor
 */
const BaseModel = function (params) {
  const oThis = this
  ;

  oThis.ddbServiceObj = params.ddb_service;
  oThis.shardMgmtObj = oThis.ddbServiceObj.shardManagement();
  oThis.autoScalingObj = params.auto_scaling;

  oThis.shardName = null;
};

BaseModel.prototype = {

  /**
   * Allocate
   *
   * @return {promise<result>}
   */
  allocate: async function () {
    const oThis = this
    ;

    let getShardsByTypeParams = {
      entity_type: oThis.entityType,
      shard_type: 'enabled'
    };

    let getShardsByTypeResponse = await oThis.shardMgmtObj.getShardsByType(getShardsByTypeParams);
    if (getShardsByTypeResponse.isFailure()) return Promise.reject(getShardsByTypeResponse);

    let shards = getShardsByTypeResponse.data.items;
    let shardToAssignIndex = new BigNumber(oThis._shardIdentifier()).mod(new BigNumber(shards.length)).toString(10);

    let shardName = shards[shardToAssignIndex].shardName;

    let assignShardParams = {
      entity_type: oThis.entityType,
      identifier: oThis._shardIdentifier,
      shard_name: shardName
    };

    let assignShardResponse = await oThis.shardMgmtObj.assignShard(assignShardParams);
    if (assignShardResponse.isFailure()) return Promise.reject(assignShardResponse);

    return responseHelper.successWithData({});
  },

  /**
   * Hash allocated shard?
   *
   * @return {promise<result>}
   */
  hasAllocatedShard: async function () {
    const oThis = this
    ;

    return oThis._getShard()
      .then(function() {return responseHelper.successWithData({hasAllocatedShard: true});})
      .catch(function (error) {
        if (responseHelper.isCustomResult(error)) {
          return responseHelper.successWithData({hasAllocatedShard: false});
        } else {
          logger.error(oThis.entityType + '::perform::catch');
          logger.error(error);
          return responseHelper.error({
            internal_error_identifier: 'l_m_b_1',
            api_error_identifier: 'exception',
            debug_options: {},
            error_config: coreConstants.ERROR_CONFIG
          });
        }
      });
  },

  /**
   * Create and register shard
   *
   * @return {promise<result>}
   */
  createAndRegisterShard: async function (shardName) {
    const oThis = this
    ;

    let createTableResponse = await oThis.ddbServiceObj.createTable(oThis._createTableParams());
    if (createTableResponse.isFailure()) return Promise.reject(createTableResponse);

    let addShardParams = {
      shard_name: shardName,
      entity_type: oThis.entityType
    };

    let addShardResponse = await oThis.shardMgmtObj.addShard(addShardParams);
    if (addShardResponse.isFailure()) return Promise.reject(addShardResponse);

    let configureShardParams = {
      shard_name: shardName,
      allocation_type: 'enabled'
    };

    let configureShardResponse = await oThis.shardMgmtObj.configureShard(configureShardParams);
    if (configureShardResponse.isFailure()) return Promise.reject(configureShardResponse);

    return responseHelper.successWithData({});
  },

  /**
   * Get shard
   *
   * @return {promise<result>}
   */
  _getShard: async function () {
    const oThis = this
    ;

    if (oThis.shardName == null) {
      let managedShardParams = {
        entity_type: oThis.entityType,
        identifiers: [oThis._shardIdentifier()]
      };

      let getManagedShardResponse = await oThis.shardMgmtObj.getManagedShard(managedShardParams);
      if (getManagedShardResponse.isFailure()) return Promise.reject(getManagedShardResponse);

      if(!getManagedShardResponse.data.items[oThis._shardIdentifier()]) {
        return Promise.reject(getManagedShardResponse);
      }

      oThis.shardName = getManagedShardResponse.data.items[oThis._shardIdentifier()].shardName;
    }

    return responseHelper.successWithData({});
  }
};

module.exports = BaseModel;