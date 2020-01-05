'use strict'

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccount.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();
const max_promises_size = 256;

(async () => {

    if (process.argv.length !== 3) {
        console.log('node import-json.js jsonfile')
        return(-1);
    }

    try {
        const jsonfile = process.argv[2];
        const json = require(jsonfile);
    
        if (!json) {
            console.error('invalid json file');
            return(1);
        }
    
        if (Object.keys(json).length !== 1) {
            console.error('allow only 1 collection per import');
            return(2);
        }

        const promises = [];
        let batch = db.batch();
        let batch_size = 0;
        for (let collection_name in json) {
            const collection = json[collection_name];
            console.log('process collection: ' + collection_name);
            for (let i = 0; i < collection.length; i++) {
                const id = pad_zeros(i+1, 5);
                const doc = collection[i];
                doc.id = id;
                const doc_ref = db.collection(collection_name).doc(id);
                console.log('process no: ' + id);
                batch.set(doc_ref, doc);
                batch_size++;
                if (batch_size === 500) {
                    promises.push(batch.commit());
                    batch = db.batch();
                    batch_size = 0;
                    if (promises.length === max_promises_size) {
                        await Promise.all(promises);
                        promises.length = 0;
                    }
                }
            }
        }
        if (batch_size > 0) {
            promises.push(batch.commit());
        }
        if (promises.length > 0) {
            await Promise.all(promises);
        }
    } catch(err) {
        console.error(err);
    }
})();

function pad_zeros(num, size) {
    const s = "000000000" + num;
    return s.substr(s.length-size);
}