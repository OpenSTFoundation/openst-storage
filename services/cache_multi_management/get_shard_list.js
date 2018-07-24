'use strict';

const rootPrefix = '../..',
  InstanceComposer = require(rootPrefix + '/instance_composer'),
  baseCache = require(rootPrefix + '/services/cache_multi_management/base'),
  responseHelper = require(rootPrefix + '/lib/formatter/response');

require(rootPrefix + '/lib/models/dynamodb/shard_management/available_shard');
require(rootPrefix + '/config/core_constants');

/**
 * @constructor
 *
 * @augments baseCache
 *
 * @param {Object} params - cache key generation & expiry related params
 *
 */
const GetShardListCacheKlass = function(params) {
  const oThis = this;
  oThis.params = params;
  oThis.identifiers = params.ids;
  oThis.idToValueMap = {};

  baseCache.call(this, oThis.params);
};

GetShardListCacheKlass.prototype = Object.create(baseCache.prototype);

GetShardListCacheKlass.prototype.constructor = GetShardListCacheKlass;

/**
 * set cache key
 *
 * @return {Object}
 */
GetShardListCacheKlass.prototype.setCacheKeyToexternalIdMap = function() {
  const oThis = this;

  oThis.cacheKeyToexternalIdMap = {};
  for (let i = 0; i < oThis.identifiers.length; i++) {
    let key = String(oThis.identifiers[i].entity_type + oThis.identifiers[i].shard_type);
    oThis.cacheKeyToexternalIdMap[
      oThis._cacheKeyPrefix() +
        'dy_sm_gsl_' +
        'et_' +
        oThis.identifiers[i].entity_type +
        'st_' +
        oThis.identifiers[i].shard_type
    ] = key;
    oThis.idToValueMap[key] = oThis.identifiers[i];
  }

  return oThis.cacheKeyToexternalIdMap;
};

/**
 * set cache expiry in oThis.cacheExpiry and return it
 *
 * @return {Number}
 */
GetShardListCacheKlass.prototype.setCacheExpiry = function() {
  const oThis = this;

  oThis.cacheExpiry = 86400; // 24 hours ;

  return oThis.cacheExpiry;
};

/**
 * fetch data from source
 *
 * @return {Result}
 */
GetShardListCacheKlass.prototype.fetchDataFromSource = async function(cacheIds) {
  const oThis = this,
    availableShard = oThis.ic().getDDBServiceAvailableShard(),
    coreConstants = oThis.ic().getCoreConstants();

  if (!cacheIds) {
    return responseHelper.error({
      internal_error_identifier: 's_cmm_gsl_1',
      api_error_identifier: 'invalid_cache_ids',
      debug_options: {},
      error_config: coreConstants.ERROR_CONFIG
    });
  }

  return await availableShard.getShardsByEntityAllocation(
    Object.assign({}, oThis.params, {
      ids: cacheIds,
      id_value_map: oThis.idToValueMap
    })
  );
};

InstanceComposer.registerShadowableClass(GetShardListCacheKlass, 'getDDBServiceShardListCacheKlass');
module.exports = GetShardListCacheKlass;
