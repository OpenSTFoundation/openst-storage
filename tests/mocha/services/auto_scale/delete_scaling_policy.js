'use strict';

// Load external packages
const Chai = require('chai'),
  assert = Chai.assert;

// Load dependencies package
const rootPrefix = '../../../..',
  OSTStorage = require(rootPrefix + '/index'),
  testConstants = require(rootPrefix + '/tests/mocha/services/constants'),
  coreConstant = require(rootPrefix + '/config/coreConstant'),
  helper = require(rootPrefix + '/tests/mocha/services/auto_scale/helper'),
  logger = require(rootPrefix + '/lib/logger/customConsoleLogger');

const ostStorage = OSTStorage.getInstance(testConstants.CONFIG_STRATEGIES),
  autoScaleObj = ostStorage.ic.getInstanceFor(coreConstant.icNameSpace, 'autoScaleApiService'),
  dynamodbApiObject = ostStorage.dynamoDBService;

let resourceId = 'table/' + testConstants.dummyTestTableName,
  roleARN = null;

const createTestCasesForOptions = function(optionsDesc, options, toAssert) {
  optionsDesc = optionsDesc || '';

  options = options || { invalid_policy_name: false };

  it(optionsDesc, async function() {
    this.timeout(100000);

    let policyName = testConstants.dummyTestTableName + '-scaling-policy';
    if (options.invalid_policy_name) {
      policyName = 'invalidPolicyId';
    } else {
      const scalableTargetParams = {
        ResourceId: resourceId /* required */,
        ScalableDimension: 'dynamodb:table:WriteCapacityUnits',
        ServiceNamespace: 'dynamodb' /* required */,
        MaxCapacity: 15,
        MinCapacity: 1,
        RoleARN: roleARN
      };
      const registerScalableTargetResponse = await autoScaleObj.registerScalableTarget(scalableTargetParams);
      assert.equal(registerScalableTargetResponse.isSuccess(), true, 'registerScalableTarget failed');

      const scalingPolicy = {
        ServiceNamespace: 'dynamodb',
        ResourceId: 'table/' + testConstants.dummyTestTableName,
        ScalableDimension: 'dynamodb:table:WriteCapacityUnits',
        PolicyName: policyName,
        PolicyType: 'TargetTrackingScaling',
        TargetTrackingScalingPolicyConfiguration: {
          PredefinedMetricSpecification: {
            PredefinedMetricType: 'DynamoDBWriteCapacityUtilization'
          },
          ScaleOutCooldown: 60,
          ScaleInCooldown: 60,
          TargetValue: 70.0
        }
      };
      const putScalingPolicyResponse = await autoScaleObj.putScalingPolicy(scalingPolicy);
      assert.equal(putScalingPolicyResponse.isSuccess(), true, 'putScalingPolicy failed');
    }

    const params = {
      PolicyName: testConstants.dummyTestTableName + '-scaling-policy',
      ResourceId: 'table/' + testConstants.dummyTestTableName,
      ScalableDimension: 'dynamodb:table:WriteCapacityUnits',
      ServiceNamespace: 'dynamodb'
    };

    const response = await autoScaleObj.deleteScalingPolicy(params);

    logger.log(response);
    assert.equal(response.isSuccess(), toAssert, 'describeScalingPolicies failed');
  });
};

describe('services/autoScale/api#deleteScalingPolicy', function() {
  before(async function() {
    this.timeout(1000000);

    const returnObject = await helper.createTestCaseEnvironment(dynamodbApiObject, autoScaleObj);
    roleARN = returnObject.role_arn;
  });

  createTestCasesForOptions('Delete scaling policy happy case', null, true);

  createTestCasesForOptions('Delete scaling policy having policy name case', { invalid_policy_name: true }, false);

  after(async function() {
    this.timeout(1000000);
    await helper.cleanTestCaseEnvironment(dynamodbApiObject, autoScaleObj);
  });
});
