"use strict";

/**
 *
 * This class would be used for getting available shards information.<br><br>
 *
 * @module services/shard_management/available_shard/get_shards
 *
 */

const rootPrefix = '../../../..'
  , InstanceComposer = require(rootPrefix + '/instance_composer')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , logger            = require( rootPrefix + "/lib/logger/custom_console_logger")
;

require(rootPrefix + "/config/core_constants");
require(rootPrefix + '/lib/global_constant/available_shard');
require(rootPrefix + '/lib/global_constant/managed_shard');
require(rootPrefix + '/services/cache_multi_management/get_shard_list');

/**
 * Constructor to create object of Get Shard List
 *
 * @constructor
 *
 * @params {Object} params - Parameters
 * @param {String} params.entity_type - entity type
 * @param {String} params.shard_type - get shard type Example :- 'all', 'enabled', 'disabled' (Default 'all')
 * @param {JSON} params.table_schema - schema of the table in shard
 *
 * @return {Object}
 *
 */
const GetShardList = function (params) {
  const oThis = this
    , availableShardGlobalConstant = oThis.ic().getLibAvailableShard()
  ;
  logger.debug("=======GetShardList.params=======");
  logger.debug(params);

  oThis.params = params;
  oThis.entityType = params.entity_type;
  oThis.shardType = params.shard_type || availableShardGlobalConstant.all;
};

GetShardList.prototype = {

  /**
   * Perform method
   *
   * @return {promise<result>}
   *
   */
  perform: async function () {
    const oThis = this
      , coreConstants = oThis.ic().getCoreConstants()
    ;

    return oThis.asyncPerform()
      .catch(function(err){
        return responseHelper.error({
          internal_error_identifier:"s_sm_as_gsl_perform_1",
          api_error_identifier: "exception",
          debug_options: {error: err},
          error_config: coreConstants.ERROR_CONFIG
        });
    });
  },

  /**
   * Async Perform
   *
   * @return {Promise<*>}
   */
  asyncPerform: async function () {
    const oThis = this
    ;

    let r = null;

    r = await oThis.validateParams();
    logger.debug("=======GetShardList.validateParams.result=======");
    logger.debug(r);
    if (r.isFailure()) return r;

    r = await oThis.getShardListFromCache();

    return r;
  },

  /**
   * Validation of params
   *
   * @return {Promise<any>}
   *
   */
  validateParams: function () {
    const oThis = this
      , coreConstants = oThis.ic().getCoreConstants()
      , availableShardGlobalConstant = oThis.ic().getLibAvailableShard()
    ;

    return new Promise(async function (onResolve) {

      if (!oThis.shardType || (availableShardGlobalConstant.getShardTypes()[oThis.shardType] === undefined) ) {
        logger.debug('s_sm_as_gsl_validateParams_2', 'shardType is', oThis.shardType);
        return onResolve(responseHelper.error({
          internal_error_identifier: "s_sm_as_gsl_validateParams_2",
          api_error_identifier: "invalid_shard_type",
          debug_options: {},
          error_config: coreConstants.ERROR_CONFIG
        }));
      }

      return onResolve(responseHelper.successWithData({}));
    });
  },

  /**
   * To get shard List from cache
   * @return {Promise<*|Object<Result>>}
   */
  getShardListFromCache : async function () {
    const oThis = this
      , GetShardListMultiCacheKlass = oThis.ic().getDDBServiceShardListCacheKlass()
      , cacheParams = {
      ids: [{entity_type: oThis.entityType, shard_type: oThis.shardType}]
    };
    let r = await new GetShardListMultiCacheKlass(cacheParams).fetch();
    logger.debug("=======GetShardList.addShard.result=======");
    logger.debug(r);
    if (r.isSuccess()) {
      return responseHelper.successWithData({items: r.data[String(oThis.entityType + oThis.shardType)]});
    } else {
      return responseHelper;
    }
  }
};


InstanceComposer.registerShadowableClass(GetShardList, 'getDdbShardList'); //getShardList
module.exports = GetShardList;