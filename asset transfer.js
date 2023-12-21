/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';
//const sdkUtils = require('/usr/local/src/node_modules/fabric-common/lib/Utils');
//const logger = sdkUtils.getLogger('CHAINCODE');
// Deterministic JSON.stringify()
const stringify  = require('json-stringify-deterministic');
const sortKeysRecursive  = require('sort-keys-recursive');
const { Contract } = require('fabric-contract-api');
const memberAssetCollectionName = 'assetCollection';

class AssetTransfer extends Contract {

    async InitLedger(ctx) {
        const assets = [
            {
                ID: 'asset1',
                Color: 'blue',
                Size: 5,
                Owner: 'Tomoko',
                AppraisedValue: 300,
            },
            {
                ID: 'asset2',
                Color: 'red',
                Size: 5,
                Owner: 'Brad',
                AppraisedValue: 400,
            },
            {
                ID: 'asset3',
                Color: 'green',
                Size: 10,
                Owner: 'Jin Soo',
                AppraisedValue: 500,
            },
            {
                ID: 'asset4',
                Color: 'yellow',
                Size: 10,
                Owner: 'Max',
                AppraisedValue: 600,
            },
            {
                ID: 'asset5',
                Color: 'black',
                Size: 15,
                Owner: 'Adriana',
                AppraisedValue: 700,
            },
            {
                ID: 'asset6',
                Color: 'white',
                Size: 15,
                Owner: 'Michel',
                AppraisedValue: 800,
            },
        ];

        for (const asset of assets) {
            asset.docType = 'asset';
            // example of how to write to world state deterministically
            // use convetion of alphabetic order
            // we insert data in alphabetic order using 'json-stringify-deterministic' and 'sort-keys-recursive'
            // when retrieving data, in any lang, the order of data will be the same and consequently also the corresonding hash
            await ctx.stub.putState(asset.ID, Buffer.from(stringify(sortKeysRecursive(asset))));
        }
    }

    // CreateAsset issues a new asset to the world state with given details.
    async CreateAsset(ctx, id, color, size, owner, appraisedValue) {
        const exists = await this.AssetExists(ctx, id);
        if (exists) {
            throw new Error(`The asset ${id} already exists`);
        }

        const asset = {
            ID: id,
            Color: color,
            Size: size,
            Owner: owner,
            AppraisedValue: appraisedValue,
        };
        // we insert data in alphabetic order using 'json-stringify-deterministic' and 'sort-keys-recursive'
        await ctx.stub.putState(id, Buffer.from(stringify(sortKeysRecursive(asset))));
        return JSON.stringify(asset);
    }

     // CreateAsset issues a new asset to the world state with given details.
    async CreateAsset(ctx, id, color, size, owner, appraisedValue) {
        const exists = await this.AssetExists(ctx, id);
        if (exists) {
            throw new Error(`The asset ${id} already exists`);
        }

        const asset = {
            ID: id,
            Color: color,
            Size: size,
            Owner: owner,
            AppraisedValue: appraisedValue,
        };
        // we insert data in alphabetic order using 'json-stringify-deterministic' and 'sort-keys-recursive'
        await ctx.stub.putState(id, Buffer.from(stringify(sortKeysRecursive(asset))));
        return JSON.stringify(asset);
    } 
    
    
    // CreateAsset issues a new asset to the world state with given details.
    async CreateBatch(ctx, asset) {
        const batch = JSON.parse(asset);
           console.log(batch);
            console.log(batch.batchid);
           // let key = ctx.stub.createCompositeKey("Batch", [batch.masterid]);
     /*  const exists = await this.AssetExists(ctx, batch.batchid);
        if (exists) {
            throw new Error(`The batch ${batch.batchid} already exists`);
       }*/

       let indexName = 'batch~name';
       let colorNameIndexKey = await ctx.stub.createCompositeKey(indexName, [batch.masterid, batch.location,batch.batchid]);
        // we insert data in alphabetic order using 'json-stringify-deterministic' and 'sort-keys-recursive'
        await ctx.stub.putState(colorNameIndexKey, Buffer.from(stringify(sortKeysRecursive(batch))));

       

        //  Save index entry to state. Only the key name is needed, no need to store a duplicate copy of the marble.
        //  Note - passing a 'nil' value will effectively delete the key from state, therefore we pass null character as value
        //await ctx.stub.putState(colorNameIndexKey, Buffer.from('\u0000'));

        return JSON.stringify(batch);
    }

    async QueryBatchHistory(ctx, masterid) {
    let allResults = [];
    let coloredAssetResultsIterator = await ctx.stub.getStateByPartialCompositeKey('batch~name', [masterid]);
        let res = await coloredAssetResultsIterator.next();
        while (!res.done) {
            if (res.value && res.value.value.toString()) {
                let jsonRes = {};
                console.log(res.value.value.toString('utf8'));
                
                    jsonRes.Key = res.value.key;
                    try {
                        jsonRes.Record = JSON.parse(res.value.value.toString('utf8'));
                    } catch (err) {
                        console.log(err);
                        jsonRes.Record = res.value.value.toString('utf8');
                    }
                
                allResults.push(jsonRes);
            }
            res = await coloredAssetResultsIterator.next();
        }
        coloredAssetResultsIterator.close();
        return allResults;
    }

    async QueryBatchHistorysss(ctx, masterid) {
        // Query the color~name index by color
        // This will execute a key range query on all keys starting with 'color'
        let coloredAssetResultsIterator = await ctx.stub.getStateByPartialCompositeKey('batch~name', [masterid]);

        // Iterate through result set and for each asset found, transfer to newOwner
        let responseRange = await coloredAssetResultsIterator.next();
        console.log(responseRange)
       
        while (!responseRange.done) {
            if (!responseRange || !responseRange.value || !responseRange.value.key) {
                return;
            }

            let objectType;
            let attributes;
            (
                {objectType, attributes} = await ctx.stub.splitCompositeKey(responseRange.value.key)
            );
            console.log("****\n");
            //console.log(JSON.parse(responseRange.value.value));
            console.log(objectType);
            let returnedAssetName = attributes[1];
            //console.log(Buffer.from(stringify(sortKeysRecursive(responseRange.value.value))));
            //let returnedAssetName = attributes[1];

            // Now call the transfer function for the found asset.
            // Re-use the same function that is used to transfer individual assets
            //await this.TransferAsset(ctx, returnedAssetName, newOwner);
            console.log(returnedAssetName);
            responseRange = await coloredAssetResultsIterator.next();
        }
    }

    // ReadAsset returns the asset stored in the world state with given id.
    async ReadAsset(ctx, id) {
        const assetJSON = await ctx.stub.getState(id); // get the asset from chaincode state
        if (!assetJSON || assetJSON.length === 0) {
            throw new Error(`The asset ${id} does not exist`);
        }
        return assetJSON.toString();
    }

    async QueryBatches(ctx, batchId, parentBatchId) {
        try {
            const queryString = {
                selector: {
                    docType: 'product',
                    $or: [
                        { batchid: batchId },
                        { parentbatchid: batchId },
                        { $and: [{ batchid: batchId }, { parentbatchid: { $exists: true } }] },
                        { parentbatchid: parentBatchId }
                    ]
                }
            };
    
            const queryResult = await this.GetQueryResultForQueryString(ctx, JSON.stringify(queryString));
    
            // Parse and sort the results by createdDate
            const parsedResult = JSON.parse(queryResult);
            const sortedResult = parsedResult.sort((a, b) => new Date(a.Record.createdDate).getTime() - new Date(b.Record.createdDate).getTime());
    
            return sortedResult;
        } catch (error) {
            throw new Error(`Failed to query batches: ${error.message}`);
        }
    }

    async QueryBatchByMasterID(ctx, masterid) {
        let queryString = {};
        queryString.selector = {};
        queryString.selector.docType = 'product';
        queryString.selector.masterid = masterid;
        return await this.GetQueryResultForQueryString(ctx, JSON.stringify(queryString)); //shim.success(queryResults);
    }

    async QueryByDocType(ctx) {
        let queryString = {};
        queryString.selector = {};
        queryString.selector.docType = 'product';
        return await this.GetQueryResultForQueryString(ctx, JSON.stringify(queryString)); //shim.success(queryResults);
    }
    

    async GetQueryResultForQueryString(ctx, queryString) {
        console.log(queryString)
        let resultsIterator = await ctx.stub.getQueryResult(queryString);
        let results = await this._GetAllResults(resultsIterator, false);
        console.log(results);
        return JSON.stringify(results);
    }
    
    async QueryByBatchID(ctx, batchid, location, event) {
        let queryString = {
            selector: {
                batchid: batchid,
                location: location,
                event: event
            }
        };
    
        return await this.GetQueryResultForQueryString(ctx, JSON.stringify(queryString));
    }
    
    

    // async GetQueryResultForQueryString(ctx, queryString) {
    //     const iterator = await ctx.stub.getQueryResult(queryString);

    //     const results = [];
    //     while (true) {
    //         const res = await iterator.next();
    //         if (res.value && res.value.value.toString()) {
    //             results.push(JSON.parse(res.value.value.toString('utf8')));
    //         }

    //         if (res.done) {
    //             await iterator.close();
    //             return results;
    //         }
    //     }
    // }
       

    async _GetAllResults(iterator, isHistory) {
        let allResults = [];
        let res = await iterator.next();
        while (!res.done) {
            if (res.value && res.value.value.toString()) {
                let jsonRes = {};
                console.log(res.value.value.toString('utf8'));
                if (isHistory && isHistory === true) {
                    jsonRes.TxId = res.value.txId;
                    jsonRes.Timestamp = res.value.timestamp;
                    try {
                        jsonRes.Value = JSON.parse(res.value.value.toString('utf8'));
                    } catch (err) {
                        console.log(err);
                        jsonRes.Value = res.value.value.toString('utf8');
                    }
                } else {
                    jsonRes.Key = res.value.key;
                    try {
                        jsonRes.Record = JSON.parse(res.value.value.toString('utf8'));
                    } catch (err) {
                        console.log(err);
                        jsonRes.Record = res.value.value.toString('utf8');
                    }
                }
                allResults.push(jsonRes);
            }
            res = await iterator.next();
        }
        iterator.close();
        return allResults;
    }

    
    async ReadDetailsByCompositekey(ctx,masterid) {
        let ledgerKey = ctx.stub.createCompositeKey("Batch", [masterid]);
        const assetJSON = await ctx.stub.getState(ledgerKey); // get the asset from chaincode state
        if (!assetJSON || assetJSON.length === 0) {
            throw new Error(`The asset ${masterid} does not exist`);
        }
        console.log(assetJSON)
        return assetJSON.toString();
    }

    async ReadAssetPrivateDetails(ctx,id) {
        try{
            const assetJSON = await ctx.stub.getPrivateData(memberAssetCollectionName, id);; // get the asset from chaincode state
            if (!assetJSON || assetJSON.length === 0) {
            throw new Error(`The asset ${id} does not exist`);
            }
            return assetJSON.toString();
        }catch (e) {
            return e.toString();
        }
        console.log("Returning",assetJSON )
        
    }

    async getHistoryByKey(ctx,masterid,location,batchid) {
        let indexName = 'batch~name';
       let colorNameIndexKey = await ctx.stub.createCompositeKey(indexName, [masterid, location,batchid]);
       
        const promiseOfIterator = ctx.stub.getHistoryForKey(colorNameIndexKey);
        console.log(promiseOfIterator);
        const results = [];
        for await (const keyMod of promiseOfIterator) {
            const resp = {
                timestamp: keyMod.timestamp,
                txid: keyMod.tx_id
            }
            if (keyMod.is_delete) {
                resp.data = 'KEY DELETED';
            } else {
                resp.data = keyMod.value.toString('utf8');
            }
            results.push(resp);
        }
        console.log("Returning",results )
        return results;
    }

        // CreateAsset issues a new asset to the world state with given details.

     async createPrivateData(ctx,assetCollection,asset) {
        console.log('Inside CreatePrivateData chaincode');
          //  const transientMap = ctx.stub.getTransient();
          //  const transientAssetJSON = transientMap.get('asset_properties');
          //  console.log(transientAssetJSON);
           /* if (transientAssetJSON.length === 0) {
                throw new Error('asset properties not found in the transient map');
            }
            const jsonBytesToString = String.fromCharCode(...asset);
            const jsonFromString = JSON.parse(jsonBytesToString);
    
            // Check properties
            if (jsonFromString.objectType.length === 0) {
                throw new Error('objectType field must be a non-empty string');
            }
            if (jsonFromString.assetID.length === 0) {
                throw new Error('assetID field must be a non-empty string');
            }
            if (jsonFromString.color.length === 0) {
                throw new Error('color field must be a non-empty string');
            }
            if (jsonFromString.size <= 0) {
                throw new Error('size field must be a positive integer');
            }
            if (jsonFromString.appraisedValue <= 0) {
                throw new Error('appraisedValue field must be a positive integer');
            }
            */
           // const jsonBytesToString = String.fromCharCode(...asset);
            const jsonFromString = JSON.parse(asset);
            console.log(asset);
            console.log(assetCollection);
            console.log(jsonFromString);
            console.log(jsonFromString.batchid);
            // Check if asset already exists
            const assetAsBytes = await ctx.stub.getPrivateData(assetCollection, jsonFromString.batchid);
            if (assetAsBytes.length !== 0) {
                throw new Error('this asset already exists: ' + jsonFromString.batchid);
            }
    
            // Get ID of submitting client identity
            const clientID = ctx.clientIdentity.getID();
    
            // Verify that the client is submitting request to peer in their organization
            // This is to ensure that a client from another org doesn't attempt to read or
            // write private data from this peer.
            const err = await this.verifyClientOrgMatchesPeerOrg(ctx);
            if (err !== null) {
                throw new Error('CreateAsset cannot be performed: Error ' + err);
            }
           /*const asset = {
                ID: transientAssetJSON.assetID,
                Color: transientAssetJSON.color,
                Size: transientAssetJSON.size,
                Owner: clientID,
            };*/
    
            // Save asset to private data collection
            // Typical logger, logs to stdout/file in the fabric managed docker container, running this chaincode
            // Look for container name like dev-peer0.org1.example.com-{chaincodename_version}-xyz
            await ctx.stub.putPrivateData(assetCollection, jsonFromString.batchid, Buffer.from(stringify(sortKeysRecursive(jsonFromString))));
    
            // Save asset details to collection visible to owning organization
            const assetPrivateDetails = {
                ID: jsonFromString.batchid,
                AppraisedValue: jsonFromString.agreement,
            };
            // Get collection name for this organization.
            const orgCollection = await this.getCollectionName(ctx);
            // Put asset appraised value into owners org specific private data collection
            console.log('Put: collection %v, ID %v', orgCollection, jsonFromString.batchid);
            const result = await ctx.stub.putPrivateData(orgCollection, jsonFromString.batchid, Buffer.from(stringify(sortKeysRecursive(assetPrivateDetails))));
            return result;
        }

        async getCollectionName(ctx) {
            // Get the MSP ID of submitting client identity
            const clientMSPID = ctx.clientIdentity.getMSPID();
            // Create the collection name
            const orgCollection = clientMSPID + 'PrivateCollection';
    
            return orgCollection;
        }



 // verifyClientOrgMatchesPeerOrg is an internal function used verify client org id and matches peer org id.
  async verifyClientOrgMatchesPeerOrg(ctx) {

    const clientMSPID = ctx.clientIdentity.getMSPID();

    const peerMSPID = ctx.stub.getMspID();

    if (clientMSPID !== peerMSPID) {
        throw new Error('client from org %v is not authorized to read or write private data from an org ' + clientMSPID + ' peer ' + peerMSPID);
    }

    return null;

}

    // UpdateAsset updates an existing asset in the world state with provided parameters.
    async UpdateAsset(ctx, id, color, size, owner, appraisedValue) {
        const exists = await this.AssetExists(ctx, id);
        if (!exists) {
            throw new Error(`The asset ${id} does not exist`);
        }

        // overwriting original asset with new asset
        const updatedAsset = {
            ID: id,
            Color: color,
            Size: size,
            Owner: owner,
            AppraisedValue: appraisedValue,
        };
        // we insert data in alphabetic order using 'json-stringify-deterministic' and 'sort-keys-recursive'
        return ctx.stub.putState(id, Buffer.from(stringify(sortKeysRecursive(updatedAsset))));
    }

    async UpdateBatch(ctx, asset) {
        const batch = JSON.parse(asset);
           console.log(batch);
            console.log(batch.batchid);
       // const exists = await this.AssetExists(ctx, batch.batchid);
        //if (!exists) {
        //    throw new Error(`The asset ${batch.batchid} does not exist`);
       // }

        // overwriting original asset with new asset
        let indexName = 'batch~name';
       let colorNameIndexKey = await ctx.stub.createCompositeKey(indexName, [batch.masterid, batch.location,batch.batchid]);
        // we insert data in alphabetic order using 'json-stringify-deterministic' and 'sort-keys-recursive'
        return ctx.stub.putState(colorNameIndexKey, Buffer.from(stringify(sortKeysRecursive(batch))));
    }

    async updatePrivateData(ctx,assetCollection,asset) {
        console.log('Inside CreatePrivateData chaincode');
          
           // const jsonBytesToString = String.fromCharCode(...asset);
            const jsonFromString = JSON.parse(asset);
            console.log(asset);
            console.log(assetCollection);
            console.log(jsonFromString);
            console.log(jsonFromString.batchid);
            // Check if asset already exists
            const assetAsBytes = await ctx.stub.getPrivateData(assetCollection, jsonFromString.batchid);
            if (assetAsBytes.length === 0) {
                throw new Error('this asset does not exists: ' + jsonFromString.batchid);
            }
    
            // Get ID of submitting client identity
            const clientID = ctx.clientIdentity.getID();
    
            // Verify that the client is submitting request to peer in their organization
            // This is to ensure that a client from another org doesn't attempt to read or
            // write private data from this peer.
            const err = await this.verifyClientOrgMatchesPeerOrg(ctx);
            if (err !== null) {
                throw new Error('CreateAsset cannot be performed: Error ' + err);
            }
               
            // Save asset to private data collection
            // Typical logger, logs to stdout/file in the fabric managed docker container, running this chaincode
            // Look for container name like dev-peer0.org1.example.com-{chaincodename_version}-xyz
            await ctx.stub.putPrivateData(assetCollection, jsonFromString.batchid, Buffer.from(stringify(sortKeysRecursive(jsonFromString))));
    
            // Save asset details to collection visible to owning organization
            const assetPrivateDetails = {
                ID: jsonFromString.batchid,
                AppraisedValue: jsonFromString.agreement,
            };
            // Get collection name for this organization.
            const orgCollection = await this.getCollectionName(ctx);
            // Put asset appraised value into owners org specific private data collection
            console.log('Put: collection %v, ID %v', orgCollection, jsonFromString.batchid);
            const result = await ctx.stub.putPrivateData(orgCollection, jsonFromString.batchid, Buffer.from(stringify(sortKeysRecursive(assetPrivateDetails))));
            return result;
        }

    
    // DeleteAsset deletes an given asset from the world state.
    async DeleteAsset(ctx, id) {
        const exists = await this.AssetExists(ctx, id);
        if (!exists) {
            throw new Error(`The asset ${id} does not exist`);
        }
        return ctx.stub.deleteState(id);
    }

    // async AssetExists(ctx, id) {
    //     const assetJSON = await ctx.stub.getState(id);
    //     return assetJSON && assetJSON.length > 0;
    // }
    // Assuming you have a chaincode with the following methods:

async IsBatchOwnerExists(ctx, compositeKey, department) {
    const assetData = await ctx.stub.getState(compositeKey);
    if (!assetData || assetData.length === 0) {
        return false; // Batch does not exist
    }

    // Parse the asset data (assuming it's stored as JSON)
    const asset = JSON.parse(assetData.toString());

    // Check if the department that created the batch is the current owner
    return asset.department === department;
}

async DeleteBatch(ctx, masterid, location, batchid, department) {
    const compositeKey = ctx.stub.createCompositeKey("batch~name", [masterid, location, batchid]);

    // Check if the current department is authorized to delete the batch
    const isOwner = await this.IsBatchOwnerExists(ctx, compositeKey, department);
    if (!isOwner) {
        throw new Error(`The current department (${department}) is not authorized to delete the batch`);
    }

    // Delete the asset using the composite key
    await ctx.stub.deleteState(compositeKey);

    return `Batch with masterid ${masterid}, location ${location}, and batchid ${batchid} deleted successfully.`;
}

    // TransferAsset updates the owner field of asset with given id in the world state.
    async TransferAsset(ctx, id, newOwner) {
        const assetString = await this.ReadAsset(ctx, id);
        const asset = JSON.parse(assetString);
        const oldOwner = asset.Owner;
        asset.Owner = newOwner;
        // we insert data in alphabetic order using 'json-stringify-deterministic' and 'sort-keys-recursive'
        await ctx.stub.putState(id, Buffer.from(stringify(sortKeysRecursive(asset))));
        return oldOwner;
    }

    // GetAllAssets returns all assets found in the world state.
    async GetAllAssets(ctx) {
        const allResults = [];
        // range query with empty string for startKey and endKey does an open-ended query of all assets in the chaincode namespace.
        const iterator = await ctx.stub.getStateByRange('', '');
        let result = await iterator.next();
        console.log("Result:",result)
        while (!result.done) {
            const strValue = Buffer.from(result.value.value.toString()).toString('utf8');
            console.log("Strvalue:",strValue)
            let record;
            try {
                record = JSON.parse(strValue);
                console.log("Record:", record)
            } catch (err) {
                console.log(err);
                record = strValue;
                console.log("Error:",err)
            }
            allResults.push(record);
            result = await iterator.next();
        }
        console.log("Results---",allResults);
        return JSON.stringify(allResults);
    }
}

module.exports = AssetTransfer;
