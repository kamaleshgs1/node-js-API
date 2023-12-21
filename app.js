//import x509 from 'js-x509-utils';
const express = require('express')
const app = express();
const x509 = require("js-x509-utils");
require('dotenv').config();
//const crypto = require("crypto");
const {X509Certificate} = require('crypto') ;
//const x509 = require('x509');
const openssl = require('openssl-nodejs');
const bodyParser = require('body-parser');
const createCustomLogger = require('./logger');
app.use(bodyParser.json());
const defaultLogger = createCustomLogger();
const apiLogger = createCustomLogger();
const fs = require('fs') ;
//const { FileSystemWallet, Gateway } = require('fabric-network');
const { Gateway, Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const {BlockDecoder} =require('fabric-common');
const path = require('path');
const { buildCAClient, registerAndEnrollUser, enrollAdmin } = require('../../test-application/javascript/CAUtil.js');
const { buildCCPOrg1, buildCCPOrg2, buildCCPOrg3, buildWallet } = require('../../test-application/javascript/AppUtil.js');
const { request } = require('http');
const jwt = require('jsonwebtoken');
const secretKey = process.env.SECRET_KEY || 'default_secret_key';
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
//const ccpPath = path.resolve(__dirname, '..', '..', 'first-network', 'connection-org1.json');

const users = [
  { role: 'Manufacturer', usernames: ['Manufacturer', 'YarnUnit', 'FabricUnit'], password: 'password1', refreshToken: null },
  { role: 'AnimalHusbandry', usernames: ['Farmer', 'CCID', 'FPO', 'ProcessingUnit'], password: 'password2', refreshToken: null },
  { role: 'Retailer', usernames: ['Retailer'], password: 'password3', refreshToken: null },
];

const channelName = process.env.CHANNEL_NAME || 'mychannel';
const chaincodeName = process.env.CHAINCODE_NAME || 'private';
const walletPath = path.join(__dirname, 'wallet');
//const org1UserId = 'javascriptAppUser';

const memberAssetCollectionName = 'assetCollection';
const org1PrivateCollectionName = 'Org1MSPPrivateCollection';
const org2PrivateCollectionName = 'Org2MSPPrivateCollection';
const mspOrg1 = 'Org1MSP';
const mspOrg2 = 'Org2MSP';
const mspOrg3 = 'Org3MSP';
//const Org1UserId = 'appUser1';
//const Org1UserIddep2 = 'Org1Dept2User';
//const Org2UserId = 'appUser2';
//const Org3UserId = 'appUser3';

const RED = '\x1b[31m\n';
const RESET = '\x1b[0m';

function prettyJSONString(inputString) {
              return JSON.stringify(JSON.parse(inputString), null, 2);
}

function doFail(msgString) {
    console.error(`${RED}\t${msgString}${RESET}`);
    process.exit(1);
}
// CORS Origin
app.use(function (req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', true);
  next();
});

app.use(express.json());



app.get('/init', async (req, res) => {
try {

    
              // build an in memory object with the network configuration (also known as a connection profile)
                             const ccp = buildCCPOrg1();

                             // build an instance of the fabric ca services client based on
                             // the information in the network configuration
                            const caClient = buildCAClient(FabricCAServices, ccp, 'ca.org1.example.com');

                             // setup the wallet to hold the credentials of the application user
                             const wallet = await buildWallet(Wallets, walletPath);

                             // in a real application this would be done on an administrative flow, and only once
                             await enrollAdmin(caClient, wallet, mspOrg1);

                             // in a real application this would be done only when a new user was required to be added
                             // and would be part of an administrative flow
                             await registerAndEnrollUser(caClient, wallet, mspOrg1, org1UserId, 'org1.department1');

                             // Create a new gateway instance for interacting with the fabric network.
                             // In a real application this would be done as the backend server session is setup for
                             // a user that has been verified.
                             const gateway = new Gateway();

                             try {
                                           // setup the gateway instance
                                           // The user will now be able to create connections to the fabric network and be able to
                                           // submit transactions and query. All transactions submitted by this gateway will be
                                           // signed by this user using the credentials stored in the wallet.
                                           console.log("Try to set gateway instance")
                                           await gateway.connect(ccp, {
                                                          wallet,
                                                          identity: org1UserId,
                                                          discovery: { enabled: true, asLocalhost: true } // using asLocalhost as this gateway is using a fabric network deployed locally
                                           });
                                           console.log(channelName)
                                           // Build a network instance based on the channel where the smart contract is deployed
                                           const network = await gateway.getNetwork(channelName);
                                           console.log(network)
                                           // Get the contract from the network.
                                           const contract = network.getContract(chaincodeName);
                                           console.log(chaincodeName)
                                           // Initialize a set of asset data on the channel using the chaincode 'InitLedger' function.
                                           // This type of transaction would only be run once by an application the first time it was started after it
                                           // deployed the first time. Any updates to the chaincode deployed later would likely not need to run
                                           // an "init" type function.
                                           console.log('\n--> Submit Transaction: InitLedger, function creates the initial set of assets on the ledger');
                                           await contract.submitTransaction('InitLedger');
                                           console.log('*** Result: committed');

                                           // Let's try a query type operation (function).
                                           // This will be sent to just one peer and the results will be shown.
                                           console.log('\n--> Evaluate Transaction: GetAllAssets, function returns all the current assets on the ledger');
                                           let result = await contract.evaluateTransaction('GetAllAssets');
                                           console.log(`*** Result: ${prettyJSONString(result.toString())}`);
                             }finally {
                                           // Disconnect from the gateway when the application is closing
                                           // This will close all connections to the network
                                           //gateway.disconnect();
                                           console.log("Connections are maintained")
                                           }
            res.json({status: true, message: 'Initialization done'})
              } 
   catch (err) {
    res.json({status: false, error: err});
  }
});




async function verifyAssetData(org, resultBuffer, expectedId, color, size, ownerUserId, appraisedValue) {

  let asset;
  if (resultBuffer) {
      asset = JSON.parse(resultBuffer.toString('utf8'));
  } else {
      doFail('Failed to read asset');
  }
  console.log(`*** verify asset data for: ${expectedId}`);
  if (!asset) {
      doFail('Received empty asset');
  }
  if (expectedId !== asset.assetID) {
      doFail(`recieved asset ${asset.assetID} , but expected ${expectedId}`);
  }
  if (asset.color !== color) {
      doFail(`asset ${asset.assetID} has color of ${asset.color}, expected value ${color}`);
  }
  if (asset.size !== size) {
      doFail(`Failed size check - asset ${asset.assetID} has size of ${asset.size}, expected value ${size}`);
  }

  if (asset.owner.includes(ownerUserId)) {
      console.log(`\tasset ${asset.assetID} owner: ${asset.owner}`);
  } else {
      doFail(`Failed owner check from ${org} - asset ${asset.assetID} owned by ${asset.owner}, expected userId ${ownerUserId}`);
  }
  if (appraisedValue) {
      if (asset.appraisedValue !== appraisedValue) {
          doFail(`Failed appraised value check from ${org} - asset ${asset.assetID} has appraised value of ${asset.appraisedValue}, expected value ${appraisedValue}`);
      }
  }
}



app.get('/listAll/:org/:department', async (req, res) => {
    try {
      const gatewayOrg = (req.params.org == 'Org1' ? 
      await initContractFromOrg1Identity(req.params.department): (req.params.org == 'Org2'? await initContractFromOrg2Identity(req.params.department):  await initContractFromOrg3Identity(req.params.department)));
      const networkOrg = await gatewayOrg.getNetwork(channelName);
      const contractOrg = networkOrg.getContract(chaincodeName);
      // Let's try a query type operation (function).
      // This will be sent to just one peer and the results will be shown.
      console.log('\n--> Evaluate Transaction: GetAllAssets, function returns all the current assets on the ledger');
      let result = await contractOrg.evaluateTransaction('QueryByDocType');
      console.log(result);
      console.log(`*** Result: ${prettyJSONString(result.toString())}`);
      res.json({status: true, cars: JSON.parse(result.toString())})
    }
       catch (err) {
        res.json({status: false, error: err});
      }
    });


async function enrollUsers(org,department) 
{
  try {
    
    // build an in memory object with the network configuration (also known as a connection profile)
    if(org == 'Org1')
    {
      const ccpOrg1 = buildCCPOrg1();
      const caOrg1Client = buildCAClient(FabricCAServices, ccpOrg1, 'ca.org1.example.com');
  
      // setup the wallet to cache the credentials of the application user, on the app server locally
      const walletPathOrg1 = path.join(__dirname, 'wallet/org1');
      const walletOrg1 = await buildWallet(Wallets, walletPathOrg1);
      await enrollAdmin(caOrg1Client, walletOrg1, mspOrg1);
      await registerAndEnrollUser(caOrg1Client, walletOrg1, mspOrg1, department, "");
    }
    else if(org == 'Org2'){
      //Org2
      const ccpOrg2 = buildCCPOrg2();
      const caOrg2Client = buildCAClient(FabricCAServices, ccpOrg2, 'ca.org2.example.com');
      const walletPathOrg2 = path.join(__dirname, 'wallet/org2');
      const walletOrg2 = await buildWallet(Wallets, walletPathOrg2);
      await enrollAdmin(caOrg2Client, walletOrg2, mspOrg2);
      await registerAndEnrollUser(caOrg2Client, walletOrg2, mspOrg2, department, "");

    }
    else
    {
      //Org3
      const ccpOrg3 = buildCCPOrg3();
      const caOrg3Client = buildCAClient(FabricCAServices, ccpOrg3, 'ca.org3.example.com');
      const walletPathOrg3 = path.join(__dirname, 'wallet/org3');
      const walletOrg3 = await buildWallet(Wallets, walletPathOrg3);
      await enrollAdmin(caOrg3Client, walletOrg3, mspOrg3);
      await registerAndEnrollUser(caOrg3Client, walletOrg3, mspOrg3, department, "");

    }
    
   return("Initialized Network and Enroller User for : "+org);
  }catch (error) {
    console.error(`Error in connecting to gateway: ${error}`);
    return "Error in Initializing User for "+org;
  }
} 
   


app.get('/initializeNetwork', async (req, res) => {
    try{
      const result1 = await enrollUsers('Org1','Farmer');
      const result2 = await enrollUsers('Org1','CCID');
      const result3 = await enrollUsers('Org1','FPO');
      const result4 = await enrollUsers('Org1','ProcessingUnit');
      const result5 = await enrollUsers('Org2','YarnUnit');
      const result6 = await enrollUsers('Org2','FabricUnit');
      const result7 = await enrollUsers('Org2','MFUnit');
      const result8 = await enrollUsers('Org3','Retailer');

      res.json({status: true, Response: {
        "Farmer" : JSON.parse(result1.toString()),
        "CCID" : JSON.parse(result2.toString()),
        "FPO" : JSON.parse(result3.toString()),
        "ProcessingUnit" : JSON.parse(result4.toString()),
        "YarnUnit" : JSON.parse(result5.toString()),
        "FabricUnit" : JSON.parse(result6.toString()),
        "MFUnit" : JSON.parse(result7.toString()),
        "Retailer" : JSON.parse(result8.toString())     
      }
      })
    }catch (err) {
      res.json({status: false, error: err});
    }

}  
);


app.get('/getHistory/:masterid/:org/:department/:location/:batchid', async (req, res) => {
      try {
            const gatewayOrg = (req.params.org == 'Org1' ? 
            await initContractFromOrg1Identity(req.params.department): (req.params.org == 'Org2'? await initContractFromOrg2Identity(req.params.department):  await initContractFromOrg3Identity(req.params.department)));
            const networkOrg = await gatewayOrg.getNetwork(channelName);
            const contractOrg = networkOrg.getContract(chaincodeName);
           // result = await contractOrg.evaluateTransaction('QueryBatchHistory', req.params.key);
           result = await contractOrg.evaluateTransaction('getHistoryByKey', req.params.masterid,req.params.location,req.params.batchid);
           res.json({status: true, History: JSON.parse(result.toString())})
          }catch (err) {
            res.json({status: false, error: err});
          }
      });




app.get('/loadInitialData', async (req, res) => {
  try { 

    /************Farmer Department****** */
    let gatewayOrg1 = await initContractFromOrg1Identity("Farmer");
    let networkOrg1 = await gatewayOrg1.getNetwork(channelName);
    let contractOrg1 = networkOrg1.getContract(chaincodeName);

    /***As Org1 */  
    console.log("**Loading Farmer Data***\n");
    let f1data = {
        "SenderID":"GiaFarmer",
        "currentowner":"GiaFarmer",
        "ReceiverID":"CCID1",
        "location":"Gia",
        "AnimalType":"Merino Sheep",
        "Quantity":"700kg",
        "Grade":"A",
        "batchid":"GiaMerinoBatch_01",
        "masterid":"MerinoBatch_01",
        "parentbatchid":null,
        "department":"Farmer",
        "org" : "Org1",
        "status":"Dispatched",
        "createdDate":"2023-10-30 08:30:30",
        "AdditionalInfo":{
        "VaccinatedDate":"2023-09-30 08:30:30",
        "VaccinationType":"VT",
        "VaccinatedPlace":"GIALOC",
        },
        "docType":"product"
        
  };
let f2data= {
    "SenderID":"MeeroFarmer",
    "currentowner":"MeeroFarmer",
    "ReceiverID":"CCID2",
    "location":"Meero",
    "AnimalType":"Merino Sheep",
    "Quantity":"100kg",
    "Grade":"A",
    "batchid":"MeeroMerinoBatch_01",
    "masterid":"MerinoBatch_01",
    "parentbatchid":null,
    "department":"Farmer",
    "org" : "Org1",
    "status":"Dispatched",
    "createdDate":"2023-10-30 08:35:30",
    "AdditionalInfo":{
    "VaccinatedDate":"2023-09-30 08:30:30",
    "VaccinationType":"VT",
    "VaccinatedPlace":"MEEROLOC",
    },
    "docType":"product"
};

let f3data = {"SenderID":"SasomaFarmer",
"currentowner":"SasomaFarmer",
"ReceiverID":"CCID3",
"location":"Sasoma",
"AnimalType":"Merino Sheep",
"Quantity":"100kg",
"Grade":"A",
"batchid":"SasomaMerinoBatch_01",
"masterid":"MerinoBatch_01",
"parentbatchid":null,
"department":"Farmer",
"org" : "Org1",
"status":"Dispatched",
"createdDate":"2023-10-30 08:35:30",
"AdditionalInfo":{
"VaccinatedDate":"2023-09-30 08:30:30",
"VaccinationType":"VT",
"VaccinatedPlace":"SASOLOC",
},
"docType":"product"
};

let f4data ={
  "SenderID":"RumtseyFarmer",
"currentowner":"RumtseyFarmer",
"ReceiverID":"CCID4",
"location":"Rumtsey",
"AnimalType":"Merino Sheep",
"Quantity":"100kg",
"Grade":"A",
"batchid":"RumtseyMerinoBatch_01",
"masterid":"MerinoBatch_01",
"parentbatchid":null,
"department":"Farmer",
"org" : "Org1",
"status":"Dispatched",
"createdDate":"2023-10-29 08:35:30",
"AdditionalInfo":{
"VaccinatedDate":"2023-09-30 08:30:30",
"VaccinationType":"VT",
"VaccinatedPlace":"RUMTSEYLOC"
},
"docType":"product"
};
    
    let tmapData = JSON.stringify(f1data);
    await contractOrg1.submitTransaction('CreateBatch', tmapData);
     tmapData = JSON.stringify(f2data);
    await contractOrg1.submitTransaction('CreateBatch', tmapData);
     tmapData = JSON.stringify(f3data);
    await contractOrg1.submitTransaction('CreateBatch', tmapData);
    tmapData = JSON.stringify(f4data);
    await contractOrg1.submitTransaction('CreateBatch', tmapData);

// console.log(res)
  /***** Loading CCD data******/
   gatewayOrg1 = await initContractFromOrg1Identity("CCID");
   networkOrg1 = await gatewayOrg1.getNetwork(channelName);
   contractOrg1 = networkOrg1.getContract(chaincodeName);

  let CCD1data = {
"SenderID":"GiaFarmer",
"currentowner":"CCID1",
"ReceiverID":"CCID1",
"location":"CCID1Location",
"AnimalType":"Merino Sheep",
"Quantity":"700kg",
"Grade":"A",
"batchid":"GiaMerinoBatch_01",
"masterid":"MerinoBatch_01",
"parentbatchid":null,
"department":"CCID",
"org" : "Org1",
"status":"Received",
"createdDate":"2023-10-31 08:30:30",
"docType":"product"
  };

  let CCD2Data = {
    "SenderID":"RumtseyFarmer",
"currentowner":"CCID4",
"ReceiverID":"CCID4",
"location":"CCID4Location",
"AnimalType":"Merino Sheep",
"Quantity":"100kg",
"Grade":"A",
"batchid":"RumtseyMerinoBatch_01",
"masterid":"MerinoBatch_01",
"parentbatchid":null,
"department":"CCID",
"org" : "Org1",
"status":"Received",
"createdDate":"2023-10-31 15:30:30",
"docType":"product"
  }

  let CCD3data ={
    "SenderID":"SasomaFarmer",
"currentowner":"CCID3",
"ReceiverID":"CCID3",
"location":"CCID3Location",
"AnimalType":"Merino Sheep",
"Quantity":"100kg",
"Grade":"A",
"batchid":"SasomaMerinoBatch_01",
"masterid":"MerinoBatch_01",
"parentbatchid":null,
"department":"CCID",
"org" : "Org1",
"status":"Received",
"createdDate":"2023-10-31 05:30:30",
"docType":"product"

  }

  let CCD4data = {
    "SenderID":"MeeroFarmer",
"currentowner":"MeeroFarmer",
"ReceiverID":"CCID2",
"location":"CCID2Location",
"AnimalType":"Merino Sheep",
"Quantity":"100kg",
"Grade":"A",
"batchid":"MeeroMerinoBatch_01",
"masterid":"MerinoBatch_01",
"parentbatchid":null,
"department":"CCID",
"org" : "Org1",
"status":"Received",
"createdDate":"2023-10-31 08:35:30",
"docType":"product"

  }
  let CCD1dataDispatch = {"SenderID":"CCID2",
  "currentowner":"CCID2",
  "ReceiverID":"FPO",
  "location":"CCID2Location",
  "AnimalType":"Merino Sheep",
  "Quantity":"100kg",
  "Grade":"A",
  "batchid":"MerinoCCID2Batch_01",
  "masterid":"MerinoBatch_01",
  "parentbatchid":"MeeroMerinoBatch_01",
  "department":"CCID",
  "org" : "Org1",
  "status":"Dispatched",
  "createdDate":"2023-10-30 09:35:30",
   "docType":"product"};

  let CCD2dataDispatch ={
    "SenderID":"CCID1",
"currentowner":"CCID1",
"ReceiverID":"FPO",
"location":"CCID1Location",
"AnimalType":"Merino Sheep",
"Quantity":"700kg",
"Grade":"A",
"batchid":"MerinoCCID1Batch_01",
"masterid":"MerinoBatch_01",
"parentbatchid":"GiaMerinoBatch_01",
"department":"CCID",
"org" : "Org1",
"status":"Dispatched",
"createdDate":"2023-10-31 09:30:30",
  "docType":"product"

  };
  let CCD3dataDispatch ={
    "SenderID":"CCID4",
"currentowner":"CCID4",
"ReceiverID":"FPO",
"location":"CCID4Location",
"AnimalType":"Merino Sheep",
"Quantity":"100kg",
"Grade":"A",
"batchid":"MerinoCCID4Batch_01",
"masterid":"MerinoBatch_01",
"parentbatchid":"RumtseyMerinoBatch_01",
"department":"CCID",
"org" : "Org1",
"status":"Dispatched",
"createdDate":"2023-10-31 17:30:30",
"docType":"product"
  };
  let CCD4dataDispatch ={"SenderID":"CCID3",
  "currentowner":"CCID3",
  "ReceiverID":"FPO",
  "location":"CCID3Location",
  "AnimalType":"Merino Sheep",
  "Quantity":"100kg",
  "Grade":"A",
  "batchid":"MerinoCCID3Batch_01",
  "masterid":"MerinoBatch_01",
  "parentbatchid":"SasomaMerinoBatch_01",
  "department":"CCID",
  "org" : "Org1",
  "status":"Dispatched",
  "createdDate":"2023-10-31 07:30:30",
   "docType":"product"};



    tmapData = JSON.stringify(CCD1data);
    await contractOrg1.submitTransaction('CreateBatch', tmapData);
    tmapData = JSON.stringify(CCD2Data);
    await contractOrg1.submitTransaction('CreateBatch', tmapData);
    tmapData = JSON.stringify(CCD3data);
    await contractOrg1.submitTransaction('CreateBatch', tmapData);
    tmapData = JSON.stringify(CCD4data);
    await contractOrg1.submitTransaction('CreateBatch', tmapData);

    tmapData = JSON.stringify(CCD1dataDispatch);
    await contractOrg1.submitTransaction('CreateBatch', tmapData);
    tmapData = JSON.stringify(CCD2dataDispatch);
    await contractOrg1.submitTransaction('CreateBatch', tmapData);
    tmapData = JSON.stringify(CCD3dataDispatch);
    await contractOrg1.submitTransaction('CreateBatch', tmapData);
    tmapData = JSON.stringify(CCD4dataDispatch);
    await contractOrg1.submitTransaction('CreateBatch', tmapData);


  /*************                 */

  /** FPO UNIT */
  /***Receive Batch */

  gatewayOrg1 = await initContractFromOrg1Identity("FPO");
  networkOrg1 = await gatewayOrg1.getNetwork(channelName);
  contractOrg1 = networkOrg1.getContract(chaincodeName);

  let FPOreceiver1 =  {
    "SenderID":"CCID1",
"currentowner":"FPO",
"ReceiverID":"FPO",
"location":"FPO",
"AnimalType":"Merino Sheep",
"Quantity":"700kg",
"Grade":"A",
"batchid":"MerinoCCID1Batch_01",
"masterid":"MerinoBatch_01",
"parentbatchid":"GiaMerinoBatch_01",
"department":"FPO",
"org" : "Org1",
"status":"Received",
"createdDate":"2023-10-31 10:30:30",
"docType":"product"

  }

  let FPOreceiver2={
    "SenderID":"CCID4",
"currentowner":"CCID4",
"ReceiverID":"FPO",
"location":"FPO",
"AnimalType":"Merino Sheep",
"Quantity":"100kg",
"Grade":"A",
"batchid":"MerinoCCID4Batch_01",
"masterid":"MerinoBatch_01",
"parentbatchid":"RumtseyMerinoBatch_01",
"department":"FPO",
"org" : "Org1",
"status":"Received",
"createdDate":"2023-10-31 18:30:30",
"docType":"product"
  }

let FPOreceiver3={
"SenderID":"CCID3",
"currentowner":"FPO",
"ReceiverID":"FPO",
"location":"FPO",
"AnimalType":"Merino Sheep",
"Quantity":"100kg",
"Grade":"A",
"batchid":"MerinoCCID3Batch_01",
"masterid":"MerinoBatch_01",
"parentbatchid":"SasomaMerinoBatch_01",
"department":"FPO",
"org" : "Org1",
"status":"Received",
"createdDate":"2023-10-31 08:30:30",
"docType":"product"
}

let FPOreceiver4 ={
"SenderID":"CCID2",
"currentowner":"FPO",
"ReceiverID":"FPO",
"location":"FPO",
"AnimalType":"Merino Sheep",
"Quantity":"100kg",
"Grade":"A",
"batchid":"MerinoCCID2Batch_01",
"masterid":"MerinoBatch_01",
"parentbatchid":"MeeroMerinoBatch_01",
"department":"FPO",
"org" : "Org1",
"status":"Received",
"createdDate":"2023-10-30 10:35:30",
"docType":"product"
}


//Create New Batch
let FPONewBatch={
    "SenderID":"FPO",
  "currentowner":"FPO",
  "ReceiverID":"ProcessingUnit",
  "location":"FPO",
  "AnimalType":"Merino Sheep",
  "Quantity":"700kg",
  "Grade":"A",
  "batchid":"MerinoSheepFPO_01",
  "masterid":"MerinoBatch_01",
    "parentbatchid":{
      "Aggregatedbatches":"MerinoCCID2Batch_01,MerinoCCID3Batch_01,MerinoCCID4Batch_01,MerinoCCID1Batch_01"
    },
  "department":"FPO",
  "org" : "Org1",
  "status":"Dispatched",
  "createdDate":"2023-11-01 09:30:30",
   "docType":"product"    
}

tmapData = JSON.stringify(FPOreceiver1);
await contractOrg1.submitTransaction('CreateBatch', tmapData);
tmapData = JSON.stringify(FPOreceiver2);
await contractOrg1.submitTransaction('CreateBatch', tmapData);
tmapData = JSON.stringify(FPOreceiver3);
await contractOrg1.submitTransaction('CreateBatch', tmapData);
tmapData = JSON.stringify(FPOreceiver4);
await contractOrg1.submitTransaction('CreateBatch', tmapData);
tmapData = JSON.stringify(FPONewBatch);
await contractOrg1.submitTransaction('CreateBatch', tmapData);

/**   Processing Unit */
//Receive
gatewayOrg1 = await initContractFromOrg1Identity("ProcessingUnit");
networkOrg1 = await gatewayOrg1.getNetwork(channelName);
contractOrg1 = networkOrg1.getContract(chaincodeName);

let pcreceive = {
  "SenderID":"FPO",
"currentowner":"ProcessingUnit",
"ReceiverID":"ProcessingUnit",
"location":"ProcessingUnit",
"AnimalType":"Merino Sheep",
"Quantity":"700kg",
"Grade":"A",
"batchid":"MerinoSheepFPO_01",
"masterid":"MerinoBatch_01",
"parentbatchid":{
  "Aggregatedbatches":"MerinoCCID2Batch_01,MerinoCCID3Batch_01,MerinoCCID4Batch_01,MerinoCCID1Batch_01"
},
"department":"ProcessingUnit",
"org" : "Org1",
"status":"Received",
"createdDate":"2023-11-01 10:30:30",
"docType":"product"  
}


let pcdisbatch = {
  "SenderID":"ProcessingUnit",
"currentowner":"ProcessingUnit",
"ReceiverID":"YarnFactory",
"location":"ProcessingUnit",
"AnimalType":"Merino Sheep",
"Quantity":"700kg",
"Grade":"A",
"batchid":"MerinoSheepPRC_01",
"masterid":"MerinoBatch_01",
"parentbatchid":"MerinoSheepFPO_01",
"department":"ProcessingUnit",
"org" : "Org1",
"status":"Dispatched",
"createdDate":"2023-11-01 10:30:30",
"docType":"product" 
}

tmapData = JSON.stringify(pcreceive);
await contractOrg1.submitTransaction('CreateBatch', tmapData);
tmapData = JSON.stringify(pcdisbatch);
await contractOrg1.submitTransaction('CreateBatch', tmapData);

/******  Org2 */
/*** Yarn Factory */
//Receive
let gatewayOrg2 = await initContractFromOrg2Identity("YarnUnit");
let networkOrg2 = await gatewayOrg2.getNetwork(channelName);
let contractOrg2= networkOrg2.getContract(chaincodeName);


let yarnreceive = {
"SenderID":"ProcessingUnit",
"currentowner":"YarnUnit",
"ReceiverID":"YarnUnit",
"location":"YarnUnit",
"AnimalType":"Merino Sheep",
"Quantity":"700kg",
"Grade":"A",
"batchid":"MerinoSheepPRC_01",
"masterid":"MerinoBatch_01",
"parentbatchid":"MerinoSheepFPO_01",
"department":"YarnUnit",
"org" : "Org2",
"status":"Received",
"createdDate":"2023-11-01 11:30:30",
"docType":"product"
}

let yarndispatch ={
  "SenderID":"YarnUnit",
"currentowner":"YarnUnit",
"ReceiverID":"FabricUnit",
"location":"YarnUnit",
"Product":"Thread",
"AnimalType":"Merino Sheep",
"Quantity":"700kg",
"Grade":"A",
"batchid":"MerinoSheepYarn_01",
"masterid":"MerinoBatch_01",
"parentbatchid":"MerinoSheepPRC_01",
"department":"YarnUnit",
"org" : "Org2",
"status":"Dispatched",
"createdDate":"2023-11-03 10:30:30",
"docType":"product"
}

tmapData = JSON.stringify(yarnreceive);
await contractOrg2.submitTransaction('CreateBatch', tmapData);
tmapData = JSON.stringify(yarndispatch);
await contractOrg2.submitTransaction('CreateBatch', tmapData);


/****Fabric Unit */
//Receive

gatewayOrg2 = await initContractFromOrg2Identity("FabricUnit");
networkOrg2 = await gatewayOrg2.getNetwork(channelName);
contractOrg2= networkOrg2.getContract(chaincodeName);


let fabricreceive ={
  "SenderID":"YarnUnit",
"currentowner":"FabricOwner",
"ReceiverID":"FabricUnit",
"location":"FabricUnit",
"Product":"Thread",
"AnimalType":"Merino Sheep",
"Quantity":"700kg",
"Grade":"A",
"batchid":"MerinoSheepYarn_01",
"masterid":"MerinoBatch_01",
"parentbatchid":"MerinoSheepPRC_01",
"department":"FabricUnit",
"org" : "Org2",
"status":"Received",
"createdDate":"2023-11-03 12:30:30",
"docType":"product"
}

let fabricdispatch={
  "SenderID":"FabricUnit",
"currentowner":"FabricOwner",
"ReceiverID":"Manufacturer",
"location":"FabricUnit",
"Product":"Fabric",
"AnimalType":"Merino Sheep",
"Quantity":"700kg",
"Grade":"A",
"batchid":"MerinoSheepFB_01",
"masterid":"MerinoBatch_01",
"parentbatchid":"MerinoSheepYarn_01",
"department":"FabricUnit",
"org" : "Org2",
"status":"Dispatched",
"createdDate":"2023-11-03 12:30:30",
"docType":"product"
}

tmapData = JSON.stringify(fabricreceive);
await contractOrg2.submitTransaction('CreateBatch', tmapData);
tmapData = JSON.stringify(fabricdispatch);
await contractOrg2.submitTransaction('CreateBatch', tmapData);


/****MF Unit */
gatewayOrg2 = await initContractFromOrg2Identity("MFUnit");
networkOrg2 = await gatewayOrg2.getNetwork(channelName);
contractOrg2= networkOrg2.getContract(chaincodeName);

let mfreceive = {
  "SenderID":"FabricUnit",
"currentowner":"Manufacturer",
"ReceiverID":"Manufacturer",
"location":"MFUnit",
"Product":"Fabric",
"AnimalType":"Merino Sheep",
"Quantity":"700kg",
"Grade":"A",
"batchid":"MerinoSheepFB_01",
"masterid":"MerinoBatch_01",
"parentbatchid":"MerinoSheepYarn_01",
"department":"MFUnit",
"org" : "Org2",
"status":"Received",
"createdDate":"2023-11-03 14:30:30",
"docType":"product"
}

let mfdispatch = {
  "SenderID":"Manufacturer",
"currentowner":"Manufacturer",
"ReceiverID":"Retailer",
"location":"MFUnit",
"Product":"Shawl",
"AnimalType":"Merino Sheep",
"Quantity":"700kg",
"Grade":"A",
"batchid":"MerinoSheepMF_01",
"masterid":"MerinoBatch_01",
"parentbatchid":"MerinoSheepFB_01",
"department":"MFUnit",
"org" : "Org2",
"status":"Dispatched",
"createdDate":"2023-12-03 14:30:30",
"docType":"product"
}

tmapData = JSON.stringify(mfreceive);
await contractOrg2.submitTransaction('CreateBatch', tmapData);
tmapData = JSON.stringify(mfdispatch);
await contractOrg2.submitTransaction('CreateBatch', tmapData);


/******* Org3 */
let gatewayOrg3 = await initContractFromOrg3Identity("Retailer");
let networkOrg3 = await gatewayOrg3.getNetwork(channelName);
let contractOrg3= networkOrg3.getContract(chaincodeName);

let retailerreceive = {
  "SenderID":"Manufacturer",
"currentowner":"Retailer",
"ReceiverID":"Retailer",
"location":"Retailer",
"Product":"Shawl",
"AnimalType":"Merino Sheep",
"Quantity":"700kg",
"Grade":"A",
"batchid":"MerinoSheepMF_01",
"masterid":"MerinoBatch_01",
"parentbatchid":"MerinoSheepFB_01",
"department":"Retailer",
"org" : "Org3",
"status":"Received",
"createdDate":"2023-12-04 14:30:30",
"docType":"product"
}

tmapData = JSON.stringify(retailerreceive);
await contractOrg3.submitTransaction('CreateBatch', tmapData);

res.json({status: true, message: 'Transaction (create batch) has been submitted.'})
  } catch (err) {
    res.json({status: false, error: err});
  }
});





      app.get('/getBlockDetails/:key/:org', async (req, res) => {
        try {
                try {
                    // setup the gateway instance
                    // The user will now be able to create connections to the fabric network and be able to
                    // submit transactions and query. All transactions submitted by this gateway will be
                    // signed by this user using the credentials stored in the wallet.
                  const gatewayOrg = (req.params.org == 'Org1' ? 
                  await initContractFromOrg1Identity(): (req.params.org == 'Org2'? await initContractFromOrg2Identity():  await initContractFromOrg3Identity()));
              

                   
          // console.log("Back:",gatewayOrg1)
            const networkOrg = await gatewayOrg.getNetwork(channelName);
           // console.log("Back:",networkOrg1)
           // const contractOrg = networkOrg.getContract(chaincodeName);
           const contract = networkOrg.getContract('qscc');
           console.log("***********************");
           console.log(req.params.key);
           const resultByte = await contract.evaluateTransaction(
            'GetBlockByNumber',
            channelName,
            String(req.params.key)
        );
       // const res = BlockDecoder.decode(resultByte);
        const resultJson = BlockDecoder.decodeBlock(resultByte);
        //const resultJson = JSON.stringify(fabproto6.common.Block.decode(resultByte));
        
        
       // const resultDecodedByBlockDecoder: fabproto6.common.Block = BlockDecoder.decode(resultGetByTxID);  
                    // Let's try a query type operation (function).
                    // This will be sent to just one peer and the results will be shown.
              console.log(resultJson);     
              res.json({status: true, cars: resultJson})
                }finally {
                    // Disconnect from the gateway when the application is closing
                    // This will close all connections to the network
                    //gateway.disconnect();
                }
                
            } 
           catch (err) {
            res.json({status: false, error: err});
          }
        });


        

      app.get('/getDetailsByMasterID/:key/:org/:department', async (req, res) => {
        try {
                try {
                    // setup the gateway instance
                    // The user will now be able to create connections to the fabric network and be able to
                    // submit transactions and query. All transactions submitted by this gateway will be
                    // signed by this user using the credentials stored in the wallet.
                  const gatewayOrg = (req.params.org == 'Org1' ? 
                  await initContractFromOrg1Identity(req.params.department): (req.params.org == 'Org2'? await initContractFromOrg2Identity(req.params.department):  await initContractFromOrg3Identity(req.params.department)));
       
          // console.log("Back:",gatewayOrg1)
            const networkOrg = await gatewayOrg.getNetwork(channelName);
           // console.log("Back:",networkOrg1)
            const contractOrg = networkOrg.getContract(chaincodeName);
           
                    // Let's try a query type operation (function).
                    // This will be sent to just one peer and the results will be shown.
                    console.log('\n--> Evaluate Transaction: ReadAsset, function returns an asset with a given assetID');
                    console.log(req.params.key);
                                                   result = await contractOrg.evaluateTransaction('QueryBatchByMasterID', req.params.key);
              let parsedResult = JSON.parse(result.toString());
              console.log("--Orig-",result );
              console.log("--parsed-",parsedResult );
              //sort by time asc
              let sortedresult = parsedResult.sort((a, b) => {
                console.log("---",new Date(a.Record.createdDate).getTime() );
                return new Date(a.Record.createdDate).getTime() - new Date(b.Record.createdDate).getTime(); // ascending
              })

              console.log(sortedresult);
                                                  // console.log(`*** Result: ${prettyJSONString(sortedresult.toString())}`);
              //      res.json({status: true, cars: JSON.parse(sortedresult.toString())})
              res.json({status: true, cars: sortedresult})
                }finally {
                    // Disconnect from the gateway when the application is closing
                    // This will close all connections to the network
                    //gateway.disconnect();
                }
                
            } 
           catch (err) {
            res.json({status: false, error: err});
          }
        });


app.get('/getCertificate/:org/:department', async (req, res) => {
  console.log(req.params.org)
          try {
            console.log(req.params.org)
            const child_process = require("child_process");
            let ccpPath ='';
           if(req.params.org == 'Org1')
            {
              ccpPath = path.resolve(__dirname, '..', '..', 'test-network/organizations/peerOrganizations/org1.example.com/users/User1@org1.example.com/msp/cacerts/', 'localhost-7054-ca-org1.pem');
            }
            else if(req.params.org == 'Org2')
            {
              ccpPath = path.resolve(__dirname, '..', '..', 'test-network/organizations/peerOrganizations/org2.example.com/users/User1@org2.example.com/msp/cacerts/', 'localhost-8054-ca-org2.pem');
            }
            else{
              ccpPath = path.resolve(__dirname, '..', '..', 'test-network/organizations/peerOrganizations/org3.example.com/users/User1@org3.example.com/msp/cacerts/', 'localhost-11054-ca-org3.pem');
            }
              console.log(ccpPath); 
            
            // const x509 = new crypto.X509Certificate(fs.readFileSync(ccpPath,"utf8"));
          
            const cmd = "openssl x509 -in "+ccpPath + " -text ";
              // console.log(pp);
              // var crt_pem = "<certificate in pem format which is content of your certificate.crt>";
            //  openssl(pp, function (err, buffer) {
            //  console.log(err.toString(), buffer.toString());
            //  });
      // var parsed = x509.parseCert(ccpPath);
              //const parsed = x509.parse(ccpPath, 'pem');
              //const cert = new X509Certificate(fs.readFileSync(ccpPath)); 
            
            //console.log(parsed);               
            //const value = parsed.toString() ;
            //console.log(value);
            //const cert = new X509Certificate(fs.readFileSync('public-cert.pem')); 
              //res.json({status: true, cars: JSON.parse(result.toString())})
              child_process.exec(
                cmd,
                (error, stdout, stderr) => {
                    if (error) {
                      res.json({status: false, error: error});
                    }
                    //console.log(`stdout: ${stdout}`);
                    console.log(stdout);
                    res.setHeader('Content-Type', 'application/x-pem-file');
                    res.send(stdout);
                   // res.json(stdout)
                   // console.error(`stderr: ${stderr}`);
                }
            ); 
          
          
      } 
      catch (err) {
      res.json({status: false, error: err});
    }
});
app.get('/getDetailsByID/:key/:org/:department', async (req, res) => {
        try {
                try {
                    // setup the gateway instance
                    // The user will now be able to create connections to the fabric network and be able to
                    // submit transactions and query. All transactions submitted by this gateway will be
                    // signed by this user using the credentials stored in the wallet.
                   // const gatewayOrg1 = await initContractFromOrg3Identity(req.params.department);
                    const gatewayOrg = (req.params.org == 'Org1' ? 
                    await initContractFromOrg1Identity(req.params.department): (req.params.org == 'Org2'? await initContractFromOrg2Identity(req.params.department):  await initContractFromOrg3Identity(req.params.department)));
         
          // console.log("Back:",gatewayOrg1)
            const networkOrg1 = await gatewayOrg.getNetwork(channelName);
           // console.log("Back:",networkOrg1)
            const contractOrg1 = networkOrg1.getContract(chaincodeName);
           
                    // Let's try a query type operation (function).
                    // This will be sent to just one peer and the results will be shown.
                    console.log('\n--> Evaluate Transaction: ReadAsset, function returns an asset with a given assetID');
                    console.log(req.params.key);
                                                   result = await contractOrg1.evaluateTransaction('ReadAsset', req.params.key);
                                                   console.log(`*** Result: ${prettyJSONString(result.toString())}`);
                    res.json({status: true, cars: JSON.parse(result.toString())})
                }finally {
                    // Disconnect from the gateway when the application is closing
                    // This will close all connections to the network
                    //gateway.disconnect();
                }
                
            } 
           catch (err) {
            res.json({status: false, error: err});
          }
        });
   
app.get('/getConfidentialDetails/:key/:org/:department', async (req, res) => {
          try {
            console.log(req.params.org)
            const gatewayOrg = ( req.params.org) ===  'Org1' ? 
            await initContractFromOrg1Identity(req.params.department):
            ( (req.params.org) === 'Org2'? await initContractFromOrg2Identity(req.params.department):  await initContractFromOrg3Identity(req.params.department));

            let orgpcname = org1PrivateCollectionName;
            console.log(orgpcname);
            if(req.params.org === 'Org2')
            {
               /** ~~~~~~~ Fabric client init: Using Org2 identity to Org2 Peer ~~~~~~~ */
                orgpcname = org2PrivateCollectionName;
                console.log(orgpcname);
            } 
            if(req.params.org === 'Org3')
            {
               orgpcname = org2PrivateCollectionName;
            } 
            console.log(orgpcname);
            const networkOrg = await gatewayOrg.getNetwork(channelName);
            const contractOrg = networkOrg.getContract(chaincodeName);
            // Since this sample chaincode uses, Private Data Collection level endorsement policy, addDiscoveryInterest
            // scopes the discovery service further to use the endorsement policies of collections, if any
            contractOrg.addDiscoveryInterest({ name: chaincodeName, collectionNames: [memberAssetCollectionName, orgpcname] });
             result = await contractOrg.evaluateTransaction('ReadAssetPrivateDetails', req.params.key);
             console.log(`*** Result: ${prettyJSONString(result.toString())}`);
             res.json({status: true, cars: JSON.parse(result.toString())})
            }catch (err) {
              res.json({status: false, error: err});
            }
          } );
          
          async function Org1User(department) {
            const userid = (department == 'department1' ? Org1UserId : Org1UserIddep2);
            console.log('\n--> Fabric client user & Gateway init: Using Org1 identity to Org1 Peer');
            // build an in memory object with the network configuration (also known as a connection profile)
            const ccpOrg1 = buildCCPOrg1();
        
            // build an instance of the fabric ca services client based on
            // the information in the network configuration
            const caOrg1Client = buildCAClient(FabricCAServices, ccpOrg1, 'ca.org1.example.com');
        
            // setup the wallet to cache the credentials of the application user, on the app server locally
            const walletPathOrg1 = path.join(__dirname, 'wallet/org1');
            const walletOrg1 = await buildWallet(Wallets, walletPathOrg1);
        
            // in a real application this would be done on an administrative flow, and only once
            // stores admin identity in local wallet, if needed
            await enrollAdmin(caOrg1Client, walletOrg1, mspOrg1);
            // register & enroll application user with CA, which is used as client identify to make chaincode calls
            // and stores app user identity in local wallet
            // In a real application this would be done only when a new user was required to be added
            // and would be part of an administrative flow
           // await registerAndEnrollUser(caOrg1Client, walletOrg1, mspOrg1, Org1UserId, 'org1.department1');
           await registerAndEnrollUser(caOrg1Client, walletOrg1, mspOrg1, userid, department);
        
            try {
                // Create a new gateway for connecting to Org's peer node.
                const gatewayOrg1 = new Gateway();
                // Connect using Discovery enabled
                await gatewayOrg1.connect(ccpOrg1,
                    { wallet: walletOrg1, identity: userid, discovery: { enabled: true, asLocalhost: true } });
                  console.log("Returning from org1")
                return gatewayOrg1;
            } catch (error) {
                console.error(`Error in connecting to gateway: ${error}`);
                process.exit(1);
            }
        }
async function initContractFromOrg1Identity(department) {
          const userid = department;
          console.log('\n--> Fabric client user & Gateway init: Using Org1 identity to Org1 Peer');
          // build an in memory object with the network configuration (also known as a connection profile)
          const ccpOrg1 = buildCCPOrg1();
      
          // build an instance of the fabric ca services client based on
          // the information in the network configuration
          const caOrg1Client = buildCAClient(FabricCAServices, ccpOrg1, 'ca.org1.example.com');
      
          // setup the wallet to cache the credentials of the application user, on the app server locally
          const walletPathOrg1 = path.join(__dirname, 'wallet/org1');
          const walletOrg1 = await buildWallet(Wallets, walletPathOrg1);
      
          // in a real application this would be done on an administrative flow, and only once
          // stores admin identity in local wallet, if needed
         //// await enrollAdmin(caOrg1Client, walletOrg1, mspOrg1);
          // register & enroll application user with CA, which is used as client identify to make chaincode calls
          // and stores app user identity in local wallet
          // In a real application this would be done only when a new user was required to be added
          // and would be part of an administrative flow
         // await registerAndEnrollUser(caOrg1Client, walletOrg1, mspOrg1, Org1UserId, 'org1.department1');
        //// await registerAndEnrollUser(caOrg1Client, walletOrg1, mspOrg1, userid, department);
      
          try {
              // Create a new gateway for connecting to Org's peer node.
              const gatewayOrg1 = new Gateway();
              // Connect using Discovery enabled
              await gatewayOrg1.connect(ccpOrg1,
                  { wallet: walletOrg1, identity: userid, discovery: { enabled: true, asLocalhost: true } });
                console.log("Returning from org1")
              return gatewayOrg1;
          } catch (error) {
              console.error(`Error in connecting to gateway: ${error}`);
              process.exit(1);
          }
      }
  
      async function initContractFromOrg3Identity(department) {
    const ccpOrg3 = buildCCPOrg3();
    const caOrg3Client = buildCAClient(FabricCAServices, ccpOrg3, 'ca.org3.example.com');
    const walletPathOrg3 = path.join(__dirname, 'wallet/org3');
    const walletOrg3 = await buildWallet(Wallets, walletPathOrg3);

    try {
        const gatewayOrg3 = new Gateway();
        await gatewayOrg3.connect(ccpOrg3, { wallet: walletOrg3, identity: department, discovery: { enabled: true, asLocalhost: true } });
        console.log("Returning from org3");
        return gatewayOrg3;
    } catch (error) {
        console.error(`Error in connecting to gateway: ${error}`);
        process.exit(1);
    }
}
        


  async function initContractFromOrg2Identity(department) {
          console.log('\n--> Fabric client user & Gateway init: Using Org2 identity to Org2 Peer');
          const ccpOrg2 = buildCCPOrg2();
          const caOrg2Client = buildCAClient(FabricCAServices, ccpOrg2, 'ca.org2.example.com');
      
          const walletPathOrg2 = path.join(__dirname, 'wallet/org2');
          const walletOrg2 = await buildWallet(Wallets, walletPathOrg2);
      
         //// await enrollAdmin(caOrg2Client, walletOrg2, mspOrg2);
         //// await registerAndEnrollUser(caOrg2Client, walletOrg2, mspOrg2, Org2UserId, department);
      
          try {
              // Create a new gateway for connecting to Org's peer node.
              const gatewayOrg2 = new Gateway();
              await gatewayOrg2.connect(ccpOrg2,
                  { wallet: walletOrg2, identity: department, discovery: { enabled: true, asLocalhost: true } });
              console.log("Returning from Org2");
              return gatewayOrg2;
          } catch (error) {
              console.error(`Error in connecting to gateway: ${error}`);
              process.exit(1);
          }
      }

    
      
app.post('/UpdatePrivateData', async (req, res) => {
          console.log("Inside Up Method");
          if ((typeof req.body.batchid === 'undefined' || req.body.batchid === '') ||
              (typeof req.body.batchname === 'undefined' || req.body.batchname === '') ||
              (typeof req.body.description === 'undefined' || req.body.description === '') ||
              (typeof req.body.createdDate === 'undefined' || req.body.createdDate === '') ||
              (typeof req.body.status === 'undefined' || req.body.status === '') ||
              (typeof req.body.agreement === 'undefined' || req.body.agreement === '')
              ) {
            res.json({status: false, error: {message: 'Missing body.'}});
            return;
          }

          try {

            /** ******* Fabric client init: Using Org1 identity to Org1 Peer ********** */
            const gatewayOrg1 = await initContractFromOrg1Identity();
          // console.log("Back:",gatewayOrg1)
            const networkOrg1 = await gatewayOrg1.getNetwork(channelName);
            console.log("Back:",networkOrg1)
            const contractOrg1 = networkOrg1.getContract(chaincodeName);
            console.log(contractOrg1)
            // Since this sample chaincode uses, Private Data Collection level endorsement policy, addDiscoveryInterest
            // scopes the discovery service further to use the endorsement policies of collections, if any
            contractOrg1.addDiscoveryInterest({ name: chaincodeName, collectionNames: [memberAssetCollectionName, org1PrivateCollectionName] });
    
            /** ~~~~~~~ Fabric client init: Using Org2 identity to Org2 Peer ~~~~~~~ */
            const gatewayOrg2 = await initContractFromOrg2Identity();
            const networkOrg2 = await gatewayOrg2.getNetwork(channelName);
            const contractOrg2 = networkOrg2.getContract(chaincodeName);
            contractOrg2.addDiscoveryInterest({ name: chaincodeName, collectionNames: [memberAssetCollectionName, org2PrivateCollectionName] });

            let tmapData = JSON.stringify(req.body);
            console.log('\n**************** As Org1 Client ****************');
            console.log('Adding Assets to work with:\n--> Submit Transaction: CreateAsset ' + tmapData);
           let statefulTxn = contractOrg1.createTransaction('createPrivateData');
         //  let transientData = { asset_properties: JSON.stringify(asset1Data) };
           

            result = await contractOrg1.submitTransaction('updatePrivateData',memberAssetCollectionName,tmapData)
            console.log('Result from chaincode ' + result);
            res.json({status: true, message: 'Transaction (create batch) has been submitted.'})
          }catch (err) {
            res.json({status: false, error: err});
          }
        } );


app.post('/CreatePrivateData', async (req, res) => {
          console.log("Inside TransferAmount Method");
          /*if ((typeof req.body.batchid === 'undefined' || req.body.batchid === '') ||
              (typeof req.body.batchname === 'undefined' || req.body.batchname === '') ||
              (typeof req.body.description === 'undefined' || req.body.description === '') ||
              (typeof req.body.createdDate === 'undefined' || req.body.createdDate === '') ||
              (typeof req.body.status === 'undefined' || req.body.status === '') ||
              (typeof req.body.agreement === 'undefined' || req.body.agreement === '')
              ) {
            res.json({status: false, error: {message: 'Missing body.'}});
            return;
          }*/

          try {
            const gatewayOrg = (req.body.org === 'Org1' ? 
            await initContractFromOrg1Identity(req.body.department): (req.body.org === 'Org2'? await initContractFromOrg2Identity(req.body.department):  await initContractFromOrg3Identity(req.body.department)));
            const networkOrg = await gatewayOrg.getNetwork(channelName);
            const contractOrg = networkOrg.getContract(chaincodeName);
           // console.log(contractOrg);
            const orgpcname = org1PrivateCollectionName;             
            if(typeof req.body.org === 'Org2')
            {
              orgpcname = org2PrivateCollectionName;
              console.log(orgpcname);
            } 
            // Since this sample chaincode uses, Private Data Collection level endorsement policy, addDiscoveryInterest
            // scopes the discovery service further to use the endorsement policies of collections, if any
            contractOrg.addDiscoveryInterest({ name: chaincodeName, collectionNames: [memberAssetCollectionName, orgpcname] });

            let tmapData = JSON.stringify(req.body);
            console.log(req.body);
            console.log('Adding Assets to work with:\n--> Submit Transaction: CreateAsset ' + tmapData);
           let statefulTxn = contractOrg.createTransaction('createPrivateData');
         //  let transientData = { asset_properties: JSON.stringify(asset1Data) };
           

            result = await contractOrg.submitTransaction('createPrivateData',memberAssetCollectionName,tmapData)
            console.log('Result from chaincode ' + result);
            res.json({status: true, message: 'Transaction (create batch) has been submitted.'})
          }catch (err) {
            res.json({status: false, error: err});
          }
        } );       


        app.post('/createBatch', async (req, res) => {
          try {
            // Log request information
            apiLogger.info(`Received POST request to create batch. Request Body: ${JSON.stringify(req.body)}`);
        
            // Uncomment the validation if needed
            /*
            if (
              typeof req.body.batchid === 'undefined' || req.body.batchid === '' ||
              typeof req.body.batchname === 'undefined' || req.body.batchname === '' ||
              typeof req.body.description === 'undefined' || req.body.description === '' ||
              typeof req.body.createdDate === 'undefined' || req.body.createdDate === '' ||
              typeof req.body.status === 'undefined' || req.body.status === ''
            ) {
              apiLogger.error('Invalid request body. Missing required fields.');
              res.json({ status: false, error: { message: 'Missing body.' } });
              return;
            }
            */
        
            // Process the request
            const gatewayOrg = (req.body.org === 'Org1' ? 
              await initContractFromOrg1Identity(req.body.department) : 
              (req.body.org === 'Org2' ? 
                await initContractFromOrg2Identity(req.body.department) : 
                await initContractFromOrg3Identity(req.body.department)
              )
            );
        
            const networkOrg = await gatewayOrg.getNetwork(channelName);
            const contractOrg = networkOrg.getContract(chaincodeName);
        
            let tmapData = JSON.stringify(req.body);
            await contractOrg.submitTransaction('CreateBatch', tmapData);
        
            // Log successful transaction submission
            apiLogger.info('Transaction (create batch) has been submitted.');
        
            res.json({ status: true, message: 'Transaction (create batch) has been submitted.' });
          } catch (err) {
            // Log the error
            apiLogger.error(`Error processing request: ${err}`);
            defaultLogger.info('This is a sample log message for the default logger.');
        
            // Return the error in the response
            res.json({ status: false, error: err });
          }
        });
        

app.put('/cars', async (req, res) => {
  if ((typeof req.body.key === 'undefined' || req.body.key === '') ||
      (typeof req.body.owner === 'undefined' || req.body.owner === '')) {
    res.json({status: false, error: {message: 'Missing body.'}});
    return;
  }

  try {
    const walletPath = path.join(process.cwd(), 'wallet');
    const wallet = new FileSystemWallet(walletPath);
    const userExists = await wallet.exists('user1');
    if (!userExists) {
      res.json({status: false, error: {message: 'User not exist in the wallet'}});
      return;
    }

    const gateway = new Gateway();
    await gateway.connect(ccpPath, { wallet, identity: 'user1', discovery: { enabled: true, asLocalhost: true } });
    const network = await gateway.getNetwork('mychannel');
    const contract = network.getContract('fabcar');
    await contract.submitTransaction('changeCarOwner', req.body.key, req.body.owner);
    res.json({status: true, message: 'Transaction (change car owner) has been submitted.'})
  } catch (err) {
    res.json({status: false, error: err});
  }
});


app.put('/batch', async (req, res) => {
   /* if ((typeof req.body.batchid === 'undefined' || req.body.batchid === '') ||
      (typeof req.body.batchname === 'undefined' || req.body.batchname === '') ||
      (typeof req.body.description === 'undefined' || req.body.description === '') ||
      (typeof req.body.createdDate === 'undefined' || req.body.createdDate === '') ||
      (typeof req.body.status === 'undefined' || req.body.status === '')) {
    res.json({status: false, error: {message: 'Missing body.'}});
    return;
  }*/
  
  try { 
    const gatewayOrg = (req.body.org === 'Org1' ? 
    await initContractFromOrg1Identity(req.body.department): (req.body.org === 'Org2'? await initContractFromOrg2Identity(req.body.department):  await initContractFromOrg3Identity(req.body.department)));

     const networkOrg = await gatewayOrg.getNetwork(channelName);
     const contractOrg = networkOrg.getContract(chaincodeName);
  
     let tmapData = JSON.stringify(req.body);
      await contractOrg.submitTransaction('UpdateBatch',tmapData);
      res.json({status: true, message: 'Transaction  has been updated.'})
    } catch (err) {
      res.json({status: false, error: err});
    }
  }); 
  const configData = require('./config.json');

  function getOrgNameFromDepartment(department) {
      for (const orgKey in configData) {
        let jobj=configData[orgKey].department
        // console.log(jobj)
        // console.log(department)
          if (jobj.includes(department)) {
            console.log(orgKey)
            return orgKey
           
         
             
             
             
          }
      }
      return null;
  }


  app.post('/login', (req, res) => {
    const { username, password } = req.body;
  
    // Find the user based on username and password
    const foundUser = users.find(user => user.usernames.includes(username) && user.password === password);
  
    if (foundUser) {
      // Generate JWT token
      const token = jwt.sign({ username, role: foundUser.role }, secretKey, { expiresIn: '24h' });
  
      // Save the token in the user object (for demonstration purposes)
      foundUser.refreshToken = token;
  
      // Send the token in the response
      res.json({ token });
    } else {
      // User not found or incorrect credentials
      res.status(401).json({ error: 'Invalid credentials' });
    }
  });
  
  // Authenticate Token middleware
  const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization'];
  
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized: Token not provided' });
    }
  
    jwt.verify(token, secretKey, (err, user) => {
      if (err) {
        return res.status(403).json({ error: 'Forbidden: Invalid token' });
      }
      req.user = user;
      next();
    });
  };

  app.delete('/deleteBatch/:location/:batchid/:department', async (req, res) => {
    try {
        const { location, batchid, department } = req.params;
        const masterid = 'PashminaBatch_01'; // Hardcoded masterid

        // Log request information
        const batchKey = JSON.stringify({ masterid, location, batchid });
        apiLogger.info(`Received DELETE request to delete batch. Batch Key: ${batchKey}, Department: ${department}`);

        // Process the request
        const org = 'Org1'; // Hardcoded organization
        const gatewayOrg = await initContractFromOrg1Identity(department);

        const network = await gatewayOrg.getNetwork(channelName);
        const contractOrg = network.getContract(chaincodeName);

        // Invoke the DeleteBatch function from chaincode
        const result = await contractOrg.submitTransaction('DeleteBatch', masterid, location, batchid, department);

        // Log successful transaction submission
        apiLogger.info(`Transaction (delete batch) has been submitted. Result: ${result.toString()}`);

        res.json({ status: true, message: `Transaction (delete batch) has been submitted. Result: ${result.toString()}` });
    } catch (err) {
        // Log the error
        apiLogger.error(`Error processing delete request: ${err}`);

        // Return the error in the response
        res.status(500).json({ status: false, error: err.message });
    }
});

app.post('/generateLabel', async (req, res) => {
  // req.body.append(req.body,JSON.stringify({"Org":"Org1"}))
  console.log(req)
  var convertedJSON = JSON.parse(JSON.stringify(req.body));
  //convertedJSON.org = 'Org1'
  
    convertedJSON.masterid ='PashminaBatch_01'
   
    convertedJSON.Parentbatchid ='generateParentBatchID'

 
    convertedJSON.location= 'YOUR LOCATION'
   
    convertedJSON.docType= 'product'
   
    convertedJSON.department='CCID'

    console.log(convertedJSON)

 
   
 
   
  try {
    convertedJSON.org = getOrgNameFromDepartment(convertedJSON.department);
    console.log(convertedJSON.org)
      if (!convertedJSON.org) {
          res.json({ status: false, error: 'Organization not found for this department.' });
          return;
      }
    // req.body.append(req.body,JSON.stringify({"Org":"Org1"}))
    // console.log(req.body)
    const gatewayOrg = (convertedJSON.org === 'Org1' ?
          await initContractFromOrg1Identity(convertedJSON.department): (convertedJSON.org === 'Org2'? await initContractFromOrg2Identity(convertedJSON.department):  await initContractFromOrg3Identity(convertedJSON.department)));
          const networkOrg = await gatewayOrg.getNetwork(channelName);
          const contractOrg = networkOrg.getContract(chaincodeName);
          let tmapData = JSON.stringify(convertedJSON);
          await contractOrg.submitTransaction('CreateBatch', tmapData);
         
          res.json({ status: true, message: 'Transaction (registerBatch) has been submitted.' });
  } catch (err) {
      res.json({ status: false, error: err });
  }
}); 

app.delete('/deleteLabel/:location/:batchid/:department', async (req, res) => {
  try {
    // Log request information
    const { location, batchid, department } = req.params;
    const masterid = 'PashminaBatch_01'; // Hardcoded masterid

    // Log request information
    const batchKey = JSON.stringify({ masterid, location, batchid });
    apiLogger.info(`Received DELETE request to delete batch. Batch Key: ${batchKey}, Department: ${department}`);

    // Hardcoded organization
    const org = 'Org1';

    // Add org property to the request body
    req.body.org = org;

    // Process the request
    const gatewayOrg = await initContractFromOrg1Identity(department);

    const network = await gatewayOrg.getNetwork(channelName);
    const contractOrg = network.getContract(chaincodeName);

    // Invoke the DeleteBatch function from chaincode
    const result = await contractOrg.submitTransaction('DeleteBatch', masterid, location, batchid, department);

    // Log successful transaction submission
    apiLogger.info(`Transaction (delete batch) has been submitted. Result: ${result.toString()}`);

    res.json({ status: true, message: `Transaction (delete batch) has been submitted. Result: ${result.toString()}` });
  } catch (err) {
    // Log the error
    apiLogger.error(`Error processing delete request: ${err}`);

    // Return the error in the response
    res.json({ status: false, error: err.message });
  }
});




app.post('/CaptureDispatchEvent', async (req, res) => {
  // req.body.append(req.body,JSON.stringify({"Org":"Org1"}))
  console.log(req)
  var convertedJSON = JSON.parse(JSON.stringify(req.body));
  //convertedJSON.org = 'Org1'
  
 
    convertedJSON.masterid ='PashminaBatch_01'
   
    convertedJSON.Parentbatchid ='generateParentBatchID'

 
    convertedJSON.location= 'YOUR LOCATION'
   
    convertedJSON.docType= 'product'
   
    convertedJSON.department='CCID'

    convertedJSON.event='Dispatched'

    console.log(convertedJSON)

 
   
 
   
  try {
    convertedJSON.org = getOrgNameFromDepartment(convertedJSON.department);
    console.log(convertedJSON.org)
    if (!convertedJSON.org) {
        res.json({ status: false, error: 'Organization not found for this department.' });
        return;
       
  }
    // req.body.append(req.body,JSON.stringify({"Org":"Org1"}))
    // console.log(req.body)
    const gatewayOrg = (convertedJSON.org === 'Org1' ?
          await initContractFromOrg1Identity(convertedJSON.department): (convertedJSON.org === 'Org2'? await initContractFromOrg2Identity(convertedJSON.department):  await initContractFromOrg3Identity(convertedJSON.department)));
         const networkOrg = await gatewayOrg.getNetwork(channelName);
          const contractOrg = networkOrg.getContract(chaincodeName);
          let tmapData = JSON.stringify(convertedJSON);
          await contractOrg.submitTransaction('CreateBatch', tmapData);
         
          res.json({ status: true, message: 'Transaction (CaptureDispatchEvent) has been submitted.' });
  } catch (err) {
      res.json({ status: false, error: err });
  }
});

app.delete('/deleteDispatchEvent/:location/:batchid/:department', async (req, res) => {
  try {
    // Log request information
    const { location, batchid, department } = req.params;
    const masterid = 'PashminaBatch_01'; // Hardcoded masterid
    const dispatchEventKey = JSON.stringify({ masterid, location, batchid });

    apiLogger.info(`Received DELETE request to delete DispatchEvent. DispatchEvent Key: ${dispatchEventKey}, Department: ${department}`);

    // Hardcoded organization
    const org = 'Org1';

    // Process the request
    const gatewayOrg = await initContractFromOrg1Identity(department);

    const network = await gatewayOrg.getNetwork(channelName);
    const contractOrg = network.getContract(chaincodeName);

    // Invoke the DeleteDispatchEvent function from chaincode
    const result = await contractOrg.submitTransaction('DeleteBatch', masterid, location, batchid);

    // Log successful transaction submission
    apiLogger.info(`Transaction (delete DispatchEvent) has been submitted. Result: ${result.toString()}`);

    res.json({ status: true, message: `Transaction (delete DispatchEvent) has been submitted. Result: ${result.toString()}` });
  } catch (err) {
    // Log the error
    apiLogger.error(`Error processing delete DispatchEvent request: ${err}`);

    // Return the error in the response
    res.json({ status: false, error: err.message });
  }
});


app.post('/CaptureReceiveEvent', async (req, res) => {
  // req.body.append(req.body,JSON.stringify({"Org":"Org1"}))
  console.log(req)
  var convertedJSON = JSON.parse(JSON.stringify(req.body));
  //convertedJSON.org = 'Org1'

    convertedJSON.masterid ='PashminaBatch_01'
   
    convertedJSON.Parentbatchid ='generateParentBatchID'

 
    convertedJSON.location= 'YOURLOCATION'
   
    convertedJSON.docType= 'product'
   
    convertedJSON.department='FPO'

    convertedJSON.event='Recieved'

    console.log(convertedJSON)

 
   
 
   
  try {
    convertedJSON.org = getOrgNameFromDepartment(convertedJSON.department);
    console.log(convertedJSON.org)
    if (!convertedJSON.org) {
        res.json({ status: false, error: 'Organization not found for this department.' });
        return;
       
  }
   
    // req.body.append(req.body,JSON.stringify({"Org":"Org1"}))
    // console.log(req.body)
    const gatewayOrg = (convertedJSON.org === 'Org1' ?
          await initContractFromOrg1Identity(convertedJSON.department): (convertedJSON.org === 'Org2'? await initContractFromOrg2Identity(convertedJSON.department):  await initContractFromOrg3Identity(convertedJSON.department)));
          const networkOrg = await gatewayOrg.getNetwork(channelName);
          const contractOrg = networkOrg.getContract(chaincodeName);
          let tmapData = JSON.stringify(convertedJSON);
          await contractOrg.submitTransaction('CreateBatch', tmapData);
         
          res.json({ status: true, message: 'Transaction (CaptureReceiveEvent) has been submitted.' });
  } catch (err) {
      res.json({ status: false, error: err });
  }
});

app.delete('/DeleteReceiveEvent/:location/:batchid/:department', async (req, res) => {
  try {
    // Log request information
    const { location, batchid, department } = req.params;
    const masterid = 'PashminaBatch_01'; // Hardcoded masterid
    const receiveEventKey = JSON.stringify({ masterid, location, batchid });

    apiLogger.info(`Received DELETE request to delete ReceiveEvent. ReceiveEvent Key: ${receiveEventKey}, Department: ${department}`);

    // Hardcoded organization
    const org = 'Org1';

    // Process the request
    const gatewayOrg = await initContractFromOrg1Identity(department);

    const network = await gatewayOrg.getNetwork(channelName);
    const contractOrg = network.getContract(chaincodeName);

    // Invoke the DeleteReceiveEvent function from chaincode
    const result = await contractOrg.submitTransaction('DeleteBatch', masterid, location, batchid);

    // Log successful transaction submission
    apiLogger.info(`Transaction (delete ReceiveEvent) has been submitted. Result: ${result.toString()}`);

    res.json({ status: true, message: `Transaction (delete ReceiveEvent) has been submitted. Result: ${result.toString()}` });
  } catch (err) {
    // Log the error
    apiLogger.error(`Error processing delete ReceiveEvent request: ${err}`);

    // Return the error in the response
    res.json({ status: false, error: err.message });
  }
});



app.post('/CaptureStoreEvent', async (req, res) => {
  // req.body.append(req.body,JSON.stringify({"Org":"Org1"}))
  console.log(req)
  var convertedJSON = JSON.parse(JSON.stringify(req.body));
  //convertedJSON.org = 'Org1'

    convertedJSON.masterid ='PashminaBatch_01'
   
    convertedJSON.Parentbatchid ='generateParentBatchID'

 
    convertedJSON.location= 'YOUR LOCATIONS'
   
    convertedJSON.docType= 'product'
   
    convertedJSON.department='CCID'

    console.log(convertedJSON)

 
   
 
   
  try {
    convertedJSON.org = getOrgNameFromDepartment(convertedJSON.department);
    console.log(convertedJSON.org)
    if (!convertedJSON.org) {
        res.json({ status: false, error: 'Organization not found for this department.' });
        return;
       
  }
    // req.body.append(req.body,JSON.stringify({"Org":"Org1"}))
    // console.log(req.body)
    const gatewayOrg = (convertedJSON.org === 'Org1' ?
          await initContractFromOrg1Identity(convertedJSON.department): (convertedJSON.org === 'Org2'? await initContractFromOrg2Identity(convertedJSON.department):  await initContractFromOrg3Identity(convertedJSON.department)));
          const networkOrg = await gatewayOrg.getNetwork(channelName);
          const contractOrg = networkOrg.getContract(chaincodeName);
          let tmapData = JSON.stringify(convertedJSON);
          await contractOrg.submitTransaction('CreateBatch', tmapData);
         
          res.json({ status: true, message: 'Transaction (CaptureReceiveEvent) has been submitted.' });
  } catch (err) {
      res.json({ status: false, error: err });
  }
});

app.delete('/DeleteStoreEvent/:location/:batchid/:department', async (req, res) => {
  try {
    // Log request information
    const { location, batchid, department } = req.params;
    const masterid = 'PashminaBatch_01'; // Hardcoded masterid
    const storeEventKey = JSON.stringify({ masterid, location, batchid });

    apiLogger.info(`Received DELETE request to delete StoreEvent. StoreEvent Key: ${storeEventKey}, Department: ${department}`);

    // Hardcoded organization
    const org = 'Org1';

    // Process the request
    const gatewayOrg = await initContractFromOrg1Identity(department);

    const network = await gatewayOrg.getNetwork(channelName);
    const contractOrg = network.getContract(chaincodeName);

    // Invoke the DeleteStoreEvent function from chaincode
    const result = await contractOrg.submitTransaction('DeleteBatch', masterid, location, batchid);

    // Log successful transaction submission
    apiLogger.info(`Transaction (delete StoreEvent) has been submitted. Result: ${result.toString()}`);

    res.json({ status: true, message: `Transaction (delete StoreEvent) has been submitted. Result: ${result.toString()}` });
  } catch (err) {
    // Log the error
    apiLogger.error(`Error processing delete StoreEvent request: ${err}`);

    // Return the error in the response
    res.json({ status: false, error: err.message });
  }
});


app.get('/getBatchDetails/:batchId', async (req, res) => {
  try {
    // Assuming you have a default organization and department for simplicity
    const org = 'Org1';
    const department = 'Farmer';

    // Set up the gateway instance
    const gatewayOrg = await initContractFromOrg1Identity(department);

    const networkOrg = await gatewayOrg.getNetwork(channelName);
    const contractOrg = networkOrg.getContract(chaincodeName);

    // Call the chaincode function to get batch details
    console.log('\n--> Evaluate Transaction: QueryByBatchID, function returns details for a given batchID');
    console.log(req.params.batchId);
    
    const result = await contractOrg.evaluateTransaction('QueryByBatchID', req.params.batchId);
    console.log(`*** Result: ${prettyJSONString(result.toString())}`);

    // Send the batch details as a JSON response
    res.json({ status: true, batchDetails: JSON.parse(result.toString()) });
  } catch (err) {
    // Handle errors
    res.json({ status: false, error: err.message });
  }
});

app.get('/getLabelDetails/:batchId', async (req, res) => {
  try {
    // Assuming you have a default organization and department for simplicity
    const org = 'Org1';
    const department = 'Farmer'; // Update with your actual department

    // Set up the gateway instance
    const gatewayOrg = await initContractFromOrg1Identity(department);

    const networkOrg = await gatewayOrg.getNetwork(channelName);
    const contractOrg = networkOrg.getContract(chaincodeName);

    // Call the chaincode function to get label details
    console.log('\n--> Evaluate Transaction: QueryByBatchID, function returns details for a given batchID');
    console.log(req.params.batchId);
    
    const result = await contractOrg.evaluateTransaction('QueryByBatchID', req.params.batchId);
    console.log(`*** Result: ${prettyJSONString(result.toString())}`);

    // Send the label details as a JSON response
    res.json({ status: true, labelDetails: JSON.parse(result.toString()) });
  } catch (err) {
    // Handle errors
    res.json({ status: false, error: err.message });
  }
});

app.get('/getDispatchEventDetails/:batchId/:location/:event', async (req, res) => {
  try {
      // Assuming you have a default organization and department for simplicity
      const org = 'Org1';
      const department = 'Farmer'; // Update with your actual department

      // Set up the gateway instance
      const gatewayOrg = await initContractFromOrg1Identity(department);

      const networkOrg = await gatewayOrg.getNetwork(channelName);
      const contractOrg = networkOrg.getContract(chaincodeName);

      // Call the chaincode function to get dispatch event details
      console.log('\n--> Evaluate Transaction: QueryDispatchEventByBatchID, function returns details for a given batchID');
      console.log(req.params.batchId);

      // Modify the QueryByBatchID function to include location and event
      const result = await contractOrg.evaluateTransaction('QueryByBatchID', req.params.batchId, req.params.location, req.params.event);
      console.log(`*** Result: ${prettyJSONString(result.toString())}`);

      // Send the dispatch event details as a JSON response
      res.json({ status: true, dispatchEventDetails: JSON.parse(result.toString()) });
  } catch (err) {
      // Handle errors
      res.json({ status: false, error: err.message });
  }
});


app.get('/getReceiveEventDetails/:batchId/:location/:event', async (req, res) => {
  try {
      // Assuming you have a default organization and department for simplicity
      const org = 'Org1';
      const department = 'Farmer'; // Update with your actual department

      // Set up the gateway instance
      const gatewayOrg = await initContractFromOrg1Identity(department);

      const networkOrg = await gatewayOrg.getNetwork(channelName);
      const contractOrg = networkOrg.getContract(chaincodeName);

      // Call the chaincode function to get receive event details
      console.log('\n--> Evaluate Transaction: QueryReceiveEventByBatchID, function returns details for a given batchID');
      console.log(req.params.batchId);

      // Modify the QueryByBatchID function to include location and event
      const result = await contractOrg.evaluateTransaction('QueryByBatchID', req.params.batchId, req.params.location, req.params.event);
      console.log(`*** Result: ${prettyJSONString(result.toString())}`);

      // Send the receive event details as a JSON response
      res.json({ status: true, receiveEventDetails: JSON.parse(result.toString()) });
  } catch (err) {
      // Handle errors
      res.json({ status: false, error: err.message });
  }
});


app.get('/getStoreEventDetails/:batchId', async (req, res) => {
  try {
    // Assuming you have a default organization and department for simplicity
    const org = 'Org1';
    const department = 'Farmer'; // Update with your actual department

    // Set up the gateway instance
    const gatewayOrg = await initContractFromOrg1Identity(department);

    const networkOrg = await gatewayOrg.getNetwork(channelName);
    const contractOrg = networkOrg.getContract(chaincodeName);

    // Call the chaincode function to get store event details
    console.log('\n--> Evaluate Transaction: QueryStoreEventByBatchID, function returns details for a given batchID');
    console.log(req.params.batchId);
    
    const result = await contractOrg.evaluateTransaction('QueryStoreEventByBatchID', req.params.batchId);
    console.log(`*** Result: ${prettyJSONString(result.toString())}`);

    // Send the store event details as a JSON response
    res.json({ status: true, storeEventDetails: JSON.parse(result.toString()) });
  } catch (err) {
    // Handle errors
    res.json({ status: false, error: err.message });
  }
});

app.post('/registerBatch', async (req, res) => {
  const requestBody = req.body;

  if (!('batchid' in requestBody) || requestBody.batchid === null || requestBody.batchid === undefined) {
    res.status(400).json({ status: false, error: 'Please provide the mandatory field "batchid".' });
    return;
  }

  apiLogger.info('Request body:', requestBody); // Log request body

  try {
    apiLogger.info('Request received for /registerBatch');

    var convertedJSON = JSON.parse(JSON.stringify(req.body));
    convertedJSON.masterid ='MASTERID';
    convertedJSON.Parentbatchid ='generateParentBatchID';
    convertedJSON.location= 'YOUR LOCATION';
    convertedJSON.docType= 'product';
    convertedJSON.department='CCID';

    console.log(convertedJSON)

    apiLogger.info('Converted JSON:', convertedJSON); // Log converted JSON

    convertedJSON.org = getOrgNameFromDepartment(convertedJSON.department);

    if (!convertedJSON.org) {
      res.json({ status: false, error: 'Organization not found for this department.' });
      return;
    }

    const gatewayOrg = (convertedJSON.org === 'Org1' ?
          await initContractFromOrg1Identity(convertedJSON.department): (convertedJSON.org === 'Org2'? await initContractFromOrg2Identity(convertedJSON.department):  await initContractFromOrg3Identity(convertedJSON.department)));
    const networkOrg = await gatewayOrg.getNetwork(channelName);
    const contractOrg = networkOrg.getContract(chaincodeName);
    let tmapData = JSON.stringify(convertedJSON);
    await contractOrg.submitTransaction('CreateBatch', tmapData);
   
    apiLogger.info('Transaction (create batch) has been submitted'); // Log successful transaction

    res.json({ status: true, message: 'Transaction (create batch) has been submitted.' });
  } catch (err) {
    apiLogger.error(`Error creating batch: ${err}`);
    res.json({ status: false, error: err });
  }
});

app.put('/updateLabel', async (req, res) => {
  try {
      const convertedJSON = {
          org: 'Org1',
          masterid: 'MASTERID',
          Parentbatchid: 'generateParentBatchID',
          location: 'YOUR LOCATION',
          docType: 'product',
          department: 'CCID',
          ...req.body
      };

      console.log(convertedJSON);

      const gatewayOrg = await initContractFromOrg1Identity(convertedJSON.department);
      const networkOrg = await gatewayOrg.getNetwork(channelName);
      const contractOrg = networkOrg.getContract(chaincodeName);

      // Use convertedJSON directly, no need to stringify
      await contractOrg.submitTransaction('UpdateBatch', JSON.stringify(convertedJSON));

      res.json({ status: true, message: 'Transaction (update label) has been submitted.' });
  } catch (err) {
      console.error('Error updating label:', err);
      res.status(500).json({ status: false, error: err.message || 'Unknown error occurred' });
  }
});

app.put('/UpdateDispatchEvent', async (req, res) => {
  try {
      const convertedJSON = {
          org: 'Org1',
          masterid: 'MASTERID',
          Parentbatchid: 'generateParentBatchID',
          location: 'YOUR LOCATION',
          docType: 'product',
          department: 'CCID',
          ...req.body
      };

      console.log(convertedJSON);

      const gatewayOrg = await initContractFromOrg1Identity(convertedJSON.department);
      const networkOrg = await gatewayOrg.getNetwork(channelName);
      const contractOrg = networkOrg.getContract(chaincodeName);

      // Use convertedJSON directly, no need to stringify
      await contractOrg.submitTransaction('UpdateBatch', JSON.stringify(convertedJSON));

      res.json({ status: true, message: 'Transaction (UpdateDispatchEvent) has been submitted.' });
  } catch (err) {
      console.error('Error updating label:', err);
      res.status(500).json({ status: false, error: err.message || 'Unknown error occurred' });
  }
});

app.put('/UpdateReceiveEvent', async (req, res) => {
  try {
      const convertedJSON = {
          org: 'Org1',
          masterid: 'MASTERID',
          Parentbatchid: 'generateParentBatchID',
          location: 'YOUR LOCATION',
          docType: 'product',
          department: 'CCID',
          ...req.body
      };

      console.log(convertedJSON);

      const gatewayOrg = await initContractFromOrg1Identity(convertedJSON.department);
      const networkOrg = await gatewayOrg.getNetwork(channelName);
      const contractOrg = networkOrg.getContract(chaincodeName);

      // Use convertedJSON directly, no need to stringify
      await contractOrg.submitTransaction('UpdateBatch', JSON.stringify(convertedJSON));

      res.json({ status: true, message: 'Transaction (UpdateReceiveEvent) has been submitted.' });
  } catch (err) {
      console.error('Error updating label:', err);
      res.status(500).json({ status: false, error: err.message || 'Unknown error occurred' });
  }
});


app.put('/UpdateStoreEvent', async (req, res) => {
  try {
      const convertedJSON = {
          org: 'Org1',
          masterid: 'MASTERID',
          Parentbatchid: 'generateParentBatchID',
          location: 'YOUR LOCATION',
          docType: 'product',
          department: 'CCID',
          ...req.body
      };

      console.log(convertedJSON);

      const gatewayOrg = await initContractFromOrg1Identity(convertedJSON.department);
      const networkOrg = await gatewayOrg.getNetwork(channelName);
      const contractOrg = networkOrg.getContract(chaincodeName);

      // Use convertedJSON directly, no need to stringify
      await contractOrg.submitTransaction('UpdateBatch', JSON.stringify(convertedJSON));

      res.json({ status: true, message: 'Transaction (UpdateStoreEvent  ) has been submitted.' });
  } catch (err) {
      console.error('Error updating label:', err);
      res.status(500).json({ status: false, error: err.message || 'Unknown error occurred' });
  }
});

app.listen(3000, () => {
  console.log('REST Server listening on port 3000');
});

