import axios from "axios";
import Redis from "ioredis";


// Important API information
const catApi = {
    "name": "Cat Facts",
    "keyNamespace": "fact",
    "baseUrl": "https://cat-fact.herokuapp.com",
    "expirationSeconds": 120
}


// Connections
let insertRedis = {
    "port": 6379,
    "host": "35.226.158.112",
    "password": null // Get this from the user
};

let verifyRedis = {
    "port": 13258,
    "host": "34.121.255.250",
    "password": null // Get this from the user too
};


// Get the amount specified of random cat facts
const catApiEndpoint = (amount) => `${catApi.baseUrl}/facts/random?amount=${amount}`


/**
 * Call the Cat Facts API for random cat facts
 * @param {*} amount How many cat facts to return, as an array.
 * @returns Array of Cat Fact objects
 */
const getCatFacts = async (amount) => {
    let result = await axios.get(catApiEndpoint(amount))
    return [].concat(result.data)
}
    

/**
 * Parse command-line params into something useful
 * @returns Object params
 */
const getCommandParams = () => {
    
    let params = {};

    // Get the name from the command line
    if (process.argv.length < 3) {
        // Send back a null result to show how unhappy we are
        console.error(`\n\nCorrect syntax: ${process.argv.join(" ")} REDIS-PASSWORD\n`);
        params = null;

    } else {
        // Get the password we're expecting
        params.redisPassword = process.argv[2];
    }

    return params;
}


/**
 * Insert the given facts into the given database.
 * @param {*} redis Redis connection to a db
 * @param {*} catFacts Array of Cat Facts
 * @returns Array of keys for the inserted facts
 */
const insertFacts = (redis, catFacts) => {
    
    let storedFacts = [];

    catFacts.map( fact => {
        // Build the fact and store it, without regard to successful promise
        let key = `${catApi.keyNamespace}:${fact["_id"]}`
        let value = `${fact["text"]}`
        redis.set(key, value, "EX", catApi.expirationSeconds)
        storedFacts.push(key);
    })

    return storedFacts;
}

/**
 * Verify the keys are in the given database
 * @param {*} redis Redis connection to a db
 * @param {*} keys Array of Redis keys to check
 * @param {Boolean} printOut Print what you find to the console.
 * @returns {Boolean} true -- they're all there!
 */
const verifyFacts = async (redis, keys, printOut) => {

    let verified = [];

    for (let key of keys) {
        let value = await redis.get(key)
        if (!!value) {
            // Found it. Maybe print it.
            if (printOut) console.log(`${key} --> \t [${value}]`);            
            verified.push(key)
        } 
    }

    return verified
}


let handler = async () => {
    // Get command line parameters: REDIS-PASSWORD
    let params = getCommandParams();
    if (!params) {
        console.error(`Please try again with the correct command-line params`);
        return null;
    }

    // Use the password we were given (same on both systems)
    insertRedis.password = params.redisPassword;
    verifyRedis.password = params.redisPassword;
    insertRedis = new Redis(insertRedis);
    verifyRedis = new Redis(verifyRedis);

    
    // Get some facts
    let start = new Date().getTime();
    let catFacts = await getCatFacts(100)
    let finish = new Date().getTime();
    
    // Show it
    console.log(`Received ${catFacts.length} cat facts from ${catApi.name} in ${finish - start}ms`);

    // Insert it
    let catKeys = insertFacts(insertRedis, catFacts)
    console.log(`Successfully inserted ${catKeys.length} cat facts!`);

    // Get it from the replica, but backwards
    let verified = await verifyFacts(verifyRedis, catKeys.reverse(), true)
    console.log(`Verified that ${verified.length} cat facts made it into the replica.`);
}

// Entry point
await handler();


process.exit()
