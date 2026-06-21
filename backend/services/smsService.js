const crypto = require('crypto');
const https = require('https');
require('dotenv').config();

const percentEncode = (value) => encodeURIComponent(value)
  .replace(/\+/g, '%20')
  .replace(/\*/g, '%2A')
  .replace(/%7E/g, '~');

const formatTimestamp = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

const cleanEnvValue = (value) => {
  if (!value) return '';

  return value.trim().replace(/^['"]|['"]$/g, '');
};

const requestAliyunSms = (endpoint, queryString) => new Promise((resolve, reject) => {
  const options = {
    hostname: endpoint,
    path: `/?${queryString}`,
    method: 'GET'
  };

  const req = https.request(options, (res) => {
    let body = '';
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
      body += chunk;
    });
    res.on('end', () => {
      try {
        const data = JSON.parse(body);
        resolve(data);
      } catch (err) {
        reject(new Error(`Aliyun SMS response parse failed: ${err.message}`));
      }
    });
  });

  req.on('error', reject);
  req.end();
});

const requestAliyunAction = async (params) => {
  const accessKeySecret = cleanEnvValue(process.env.ALIYUN_ACCESS_KEY_SECRET);
  const endpoint = cleanEnvValue(process.env.ALIYUN_SMS_ENDPOINT) || 'dypnsapi.aliyuncs.com';
  const sortedKeys = Object.keys(params).sort();
  const canonicalizedQueryString = sortedKeys
    .map((key) => `${percentEncode(key)}=${percentEncode(params[key])}`)
    .join('&');
  const stringToSign = `GET&%2F&${percentEncode(canonicalizedQueryString)}`;
  const signature = crypto
    .createHmac('sha1', `${accessKeySecret}&`)
    .update(stringToSign)
    .digest('base64');
  const queryString = `Signature=${percentEncode(signature)}&${canonicalizedQueryString}`;
  return requestAliyunSms(endpoint, queryString);
};

const createBaseParams = (action) => {
  const accessKeyId = cleanEnvValue(process.env.ALIYUN_ACCESS_KEY_ID);
  const accessKeySecret = cleanEnvValue(process.env.ALIYUN_ACCESS_KEY_SECRET);
  const regionId = cleanEnvValue(process.env.ALIYUN_SMS_REGION_ID) || 'cn-shanghai';
  const schemeName = cleanEnvValue(process.env.ALIYUN_SMS_SCHEME_NAME);

  if (!accessKeyId || !accessKeySecret || !schemeName) {
    throw new Error('Aliyun SMS environment variables are incomplete.');
  }

  return {
    AccessKeyId: accessKeyId,
    Action: action,
    Format: 'JSON',
    RegionId: regionId,
    SchemeName: schemeName,
    SignatureMethod: 'HMAC-SHA1',
    SignatureNonce: crypto.randomUUID(),
    SignatureVersion: '1.0',
    Timestamp: formatTimestamp(),
    Version: '2017-05-25'
  };
};

const addSourceIp = (params, sourceIp) => {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(sourceIp)) {
    params.SourceIp = sourceIp;
  }
};

exports.sendVerificationCode = async ({ phone, sourceIp = '' }) => {
  const signName = cleanEnvValue(process.env.ALIYUN_SMS_SIGN_NAME);
  const templateCode = cleanEnvValue(process.env.ALIYUN_SMS_TEMPLATE_CODE);
  const countryCode = cleanEnvValue(process.env.ALIYUN_SMS_COUNTRY_CODE) || '86';
  const templateParamName = cleanEnvValue(process.env.ALIYUN_SMS_TEMPLATE_PARAM_NAME) || 'code';
  const templateCodePlaceholder = cleanEnvValue(process.env.ALIYUN_SMS_TEMPLATE_CODE_PLACEHOLDER) || '##code##';
  const templateMinuteParamName = cleanEnvValue(process.env.ALIYUN_SMS_TEMPLATE_MINUTE_PARAM_NAME) || 'min';
  const templateMinuteValue = cleanEnvValue(process.env.ALIYUN_SMS_TEMPLATE_MINUTE_VALUE) || '5';

  if (!signName || !templateCode) {
    throw new Error('Aliyun SMS environment variables are incomplete.');
  }

  const params = {
    ...createBaseParams('SendSmsVerifyCode'),
    CountryCode: countryCode,
    PhoneNumber: phone,
    SignName: signName,
    TemplateCode: templateCode,
    TemplateParam: JSON.stringify({
      [templateParamName]: templateCodePlaceholder,
      [templateMinuteParamName]: templateMinuteValue
    })
  };
  addSourceIp(params, sourceIp);
  const data = await requestAliyunAction(params);

  if (data.Code !== 'OK') {
    console.error('Aliyun SMS send failed:', {
      code: data.Code,
      message: data.Message,
      requestId: data.RequestId
    });
    throw new Error(data.Message || `Aliyun SMS failed with code ${data.Code}`);
  }

  return data;
};

exports.checkVerificationCode = async ({ phone, verifyCode, sourceIp = '' }) => {
  const countryCode = cleanEnvValue(process.env.ALIYUN_SMS_COUNTRY_CODE) || '86';

  if (!verifyCode || !/^\d{4,8}$/.test(String(verifyCode).trim())) {
    return false;
  }

  const params = {
    ...createBaseParams('CheckSmsVerifyCode'),
    CountryCode: countryCode,
    PhoneNumber: phone,
    VerifyCode: String(verifyCode).trim()
  };
  addSourceIp(params, sourceIp);
  const data = await requestAliyunAction(params);

  if (data.Code !== 'OK') {
    console.error('Aliyun SMS verify failed:', {
      code: data.Code,
      message: data.Message,
      requestId: data.RequestId
    });
    return false;
  }

  return true;
};
