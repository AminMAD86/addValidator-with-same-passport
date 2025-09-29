#!/usr/bin/env node

// Import necessary modules
import { ethers } from 'ethers';
import readline from 'node:readline';

// --- Configuration ---
// These are hardcoded as in your original script.
// For more flexibility, consider using environment variables or command-line arguments.
const RPC_URL = 'https://ethereum-sepolia-rpc.publicnode.com';
const CONTRACT_ADDRESS = '0x3743c7Bf782260824f62e759677d7C63FfE42c52';

// Contract ABI for the addValidator function
// This ABI structure implies the order of arguments:
// _attester, _merkleProof, _params, _publicKeyG1, _publicKeyG2, _signature
const CONTRACT_ABI = [
    {
        "inputs": [
            {"internalType": "address", "name": "_attester", "type": "address"},
            {"internalType": "bytes32[]", "name": "_merkleProof", "type": "bytes32[]"},
            {
                "components": [
                    {"internalType": "bytes32", "name": "vkeyHash", "type": "bytes32"},
                    {"internalType": "bytes", "name": "proof", "type": "bytes"},
                    {"internalType": "bytes32[]", "name": "publicInputs", "type": "bytes32[]"},
                    {"internalType": "bytes", "name": "committedInputs", "type": "bytes"},
                    {"internalType": "uint256[]", "name": "committedInputCounts", "type": "uint256[]"},
                    {"internalType": "uint256", "name": "validityPeriodInSeconds", "type": "uint256"},
                    {"internalType": "string", "name": "domain", "type": "string"},
                    {"internalType": "string", "name": "scope", "type": "string"},
                    {"internalType": "bool", "name": "devMode", "type": "bool"}
                ],
                "internalType": "struct ProofVerificationParams",
                "name": "_params",
                "type": "tuple"
            },
            {
                "components": [
                    {"internalType": "uint256", "name": "x", "type": "uint256"},
                    {"internalType": "uint256", "name": "y", "type": "uint256"}
                ],
                "internalType": "struct G1Point",
                "name": "_publicKeyG1",
                "type": "tuple"
            },
            {
                "components": [
                    {"internalType": "uint256", "name": "x0", "type": "uint256"},
                    {"internalType": "uint256", "name": "x1", "type": "uint256"},
                    {"internalType": "uint256", "name": "y0", "type": "uint256"},
                    {"internalType": "uint256", "name": "y1", "type": "uint256"}
                ],
                "internalType": "struct G2Point",
                "name": "_publicKeyG2",
                "type": "tuple"
            },
            {
                "components": [
                    {"internalType": "uint256", "name": "x", "type": "uint256"},
                    {"internalType": "uint256", "name": "y", "type": "uint256"}
                ],
                "internalType": "struct G1Point",
                "name": "_signature",
                "type": "tuple"
            }
        ],
        "name": "addValidator",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

// --- Helper Functions ---

/**
 * Prompts the user for input and returns their response.
 * @param {string} prompt - The message to display to the user.
 * @returns {Promise<string>} The user's input as a string.
 */
async function getUserInput(prompt) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        historySize: 0, // Prevent input history for sensitive data
    });

    return new Promise((resolve) => {
        rl.question(prompt, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

/**
 * Parses a string representation of arguments, attempting to handle JSON arrays
 * and tuple-like structures common in browser console output.
 * @param {string} argsInput - The raw string input from the user.
 * @returns {Array<any>} An array of parsed arguments.
 * @throws {Error} If the input format is invalid.
 */
function parseArgsData(argsInput) {
    console.log('🔧 Parsing arguments data...');

    if (!argsInput) {
        throw new Error('No input data provided for parsing.');
    }

    let cleanInput = argsInput.trim();

    // Remove common prefixes like "args:" or "args :"
    if (cleanInput.startsWith('args:')) {
        cleanInput = cleanInput.substring(4).trim();
    } else if (cleanInput.startsWith('args :')) {
        cleanInput = cleanInput.substring(5).trim();
    }

    let parsedArgs = null;

    // Attempt 1: Direct JSON parsing (e.g., "[ '0x...', { ... }, ... ]")
    try {
        if ((cleanInput.startsWith('[') && cleanInput.endsWith(']'))) {
            parsedArgs = JSON.parse(cleanInput);
            console.log('   ✅ Successfully parsed as JSON array.');
            return parsedArgs;
        }
    } catch (jsonError) {
        console.log(`   ⚠️ Direct JSON parsing failed: ${jsonError.message}. Attempting tuple parsing.`);
        // If JSON parsing fails, proceed to try tuple parsing.
    }

    // Attempt 2: Parse tuple-like string (e.g., "( '0x...', { ... }, ... )")
    if (cleanInput.startsWith('(') && cleanInput.endsWith(')')) {
        console.log('   🔧 Attempting to parse as tuple format...');
        
        // Remove outer parentheses and trim
        cleanInput = cleanInput.substring(1, cleanInput.length - 1).trim();

        const parts = [];
        let currentPart = '';
        let depth = 0; // Tracks nesting level for parentheses `()`
        let braceDepth = 0; // Tracks nesting level for curly braces `{}`
        let bracketDepth = 0; // Tracks nesting level for square brackets `[]`
        let inString = false;
        let stringChar = ''; // Stores the quote character (' or ") if inside a string

        for (let i = 0; i < cleanInput.length; i++) {
            const char = cleanInput[i];

            if (inString) {
                currentPart += char;
                if (char === stringChar) {
                    // Check if the quote is escaped (e.g., \\")
                    if (i > 0 && cleanInput[i - 1] === '\\') {
                        // This is an escaped quote, so it's part of the string.
                    } else {
                        // This is the closing quote for the string.
                        inString = false;
                        stringChar = '';
                    }
                }
            } else {
                // Not currently inside a string
                if (char === '"' || char === "'") {
                    // Start of a new string literal
                    inString = true;
                    stringChar = char;
                    currentPart += char;
                } else if (char === '(') {
                    depth++;
                    currentPart += char;
                } else if (char === ')') {
                    depth--;
                    currentPart += char;
                } else if (char === '{') {
                    braceDepth++;
                    currentPart += char;
                } else if (char === '}') {
                    braceDepth--;
                    currentPart += char;
                } else if (char === '[') {
                    bracketDepth++;
                    currentPart += char;
                } else if (char === ']') {
                    bracketDepth--;
                    currentPart += char;
                } else if (char === ',' && depth === 0 && braceDepth === 0 && bracketDepth === 0) {
                    // A comma at the top level signifies the end of a part.
                    parts.push(currentPart.trim());
                    currentPart = ''; // Reset for the next part.
                } else {
                    // Append the character to the current part.
                    currentPart += char;
                }
            }
        }

        // Add the last part after the loop finishes.
        if (currentPart.trim()) {
            parts.push(currentPart.trim());
        }

        // Attempt to parse each part, trying to convert them to appropriate types.
        // This step is a heuristic, as direct parsing of diverse types from strings is complex.
        parsedArgs = parts.map(part => {
            part = part.trim();
            if (!part) return null; // Skip empty parts.

            // Try to parse as JSON object or array first.
            if ((part.startsWith('{') && part.endsWith('}')) || (part.startsWith('[') && part.endsWith(']'))) {
                try {
                    return JSON.parse(part);
                } catch (e) {
                    console.log(`   ⚠️ Could not parse part as JSON: ${part.substring(0, 50)}... Error: ${e.message}. Treating as string.`);
                    // Fallback to treating as a string if JSON parsing fails.
                }
            }
            
            // If it's not JSON, attempt to treat it as a string.
            // ethers.js will later handle conversion of hex strings, numbers, etc.
            // to its internal types (like BigInt, Address).
            return part;
        });

        console.log(`   ✅ Parsed tuple into ${parsedArgs.length} parts.`);
        return parsedArgs;
    }

    // If neither JSON nor tuple format matched.
    throw new Error(`Invalid input format. Expected JSON array '[ ... ]' or tuple '( ... )'. Received: ${cleanInput.substring(0, 150)}...`);
}

/**
 * Extracts specific data fields from the parsed arguments array.
 * Assumes the order of arguments matches the contract ABI.
 * @param {Array<any>} args - The parsed arguments from parseArgsData.
 * @returns {object} An object containing extracted validator data.
 * @throws {Error} If required data is missing or malformed.
 */
function extractDataFromArgs(args) {
    console.log('🔍 Extracting specific data from parsed arguments...');

    if (!Array.isArray(args) || args.length < 6) {
        throw new Error(`Expected at least 6 arguments, but received ${args?.length || 0}. Check the console log output format.`);
    }

    try {
        // Argument 0: Attester Address
        const attester = args[0];
        if (typeof attester !== 'string' || !ethers.isAddress(attester)) {
            throw new Error(`Invalid attester address format: ${attester}`);
        }
        console.log(`   Attester Address: ${attester}`);

        // Argument 1: Merkle Proof (expected to be an array of bytes32)
        const merkleProof = args[1] || [];
        if (!Array.isArray(merkleProof)) {
            throw new Error(`Merkle proof is not an array: ${merkleProof}`);
        }
        console.log(`   Merkle Proof: ${merkleProof.length} elements found.`);

        // Argument 2: ZKPassport Data (_params tuple)
        let zkPassportData = args[2];
        if (typeof zkPassportData === 'string') {
            // Sometimes the object might be stringified within the logs.
            try {
                zkPassportData = JSON.parse(zkPassportData);
                console.log('   ✅ Successfully parsed ZKPassport data from string.');
            } catch (e) {
                console.log(`   ⚠️ Could not parse ZKPassport data string: ${e.message}. Using raw string if applicable.`);
            }
        }
        if (!zkPassportData || typeof zkPassportData !== 'object') {
            throw new Error(`ZKPassport data (_params) is not a valid object. Type received: ${typeof zkPassportData}`);
        }
        console.log(`   ZKPassport data (params) extracted. publicInputs count: ${zkPassportData.publicInputs?.length || 0}`);

        // Arguments 3, 4, 5: BLS Keys and Signature
        const publicKeyG1 = args[3];
        const publicKeyG2 = args[4];
        const signature = args[5];

        if (!publicKeyG1 || !publicKeyG2 || !signature) {
            throw new Error('Missing BLS public keys (G1, G2) or signature data.');
        }
        console.log('   BLS Public Keys (G1, G2) and Signature data extracted.');

        return {
            attester,
            merkleProof,
            zkPassportData, // This object should contain all fields of the _params tuple
            publicKeyG1,
            publicKeyG2,
            signature
        };

    } catch (error) {
        console.error(`   ❌ Error during data extraction: ${error.message}`);
        throw error;
    }
}

/**
 * Calls the addValidator function on the smart contract using the provided data.
 * @param {ethers.Wallet} wallet - The signer wallet.
 * @param {object} extractedData - The data extracted from the console logs.
 * @returns {Promise<ethers.TransactionReceipt>} The transaction receipt upon successful confirmation.
 */
async function callAddValidator(wallet, extractedData) {
    console.log('🚀 Calling addValidator function on the contract...');

    try {
        // Initialize ethers provider using v6 syntax
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        
        // Connect the wallet to the provider
        const connectedWallet = wallet.connect(provider);

        // Create a contract instance
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, connectedWallet);

        // Display details before sending the transaction
        console.log('📋 Transaction Parameters:');
        console.log(`   Contract Address: ${CONTRACT_ADDRESS}`);
        console.log(`   Attester: ${extractedData.attester}`);
        console.log(`   Merkle Proof: ${extractedData.merkleProof.length} elements`);
        console.log(`   ZKPassport Params: Contains ${Object.keys(extractedData.zkPassportData).length} fields`);
        console.log(`   BLS Keys/Signature: Provided`);

        // Estimate gas for the transaction
        console.log('⛽ Estimating gas...');
        let gasEstimate;
        try {
            gasEstimate = await contract.addValidator.estimateGas(
                extractedData.attester,
                extractedData.merkleProof,
                extractedData.zkPassportData,
                extractedData.publicKeyG1,
                extractedData.publicKeyG2,
                extractedData.signature
            );
            console.log(`   Gas estimate: ${gasEstimate.toString()}`);
        } catch (gasError) {
            console.warn(`   ⚠️ Gas estimation failed: ${gasError.message}. Using a fallback gas limit.`);
            // Fallback gas limit (as a BigInt for ethers v6)
            gasEstimate = 2_000_000n;
            console.log(`   Using fallback gas limit: ${gasEstimate.toString()}`);
        }
        
        // Add a buffer to the gas estimate (e.g., 20%)
        const gasLimitWithBuffer = gasEstimate * 120n / 100n;

        // Send the transaction
        console.log('📤 Sending transaction...');
        const tx = await contract.addValidator(
            extractedData.attester,
            extractedData.merkleProof,
            extractedData.zkPassportData,
            extractedData.publicKeyG1,
            extractedData.publicKeyG2,
            extractedData.signature,
            {
                gasLimit: gasLimitWithBuffer
            }
        );
        
        console.log(`   Transaction sent. Hash: ${tx.hash}`);
        console.log('⏳ Waiting for transaction confirmation...');
        
        const receipt = await tx.wait();
        
        console.log(`✅ Transaction confirmed!`);
        console.log(`   Block Number: ${receipt.blockNumber}`);
        console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);
        
        return receipt;
        
    } catch (error) {
        console.error(`❌ Error calling addValidator: ${error.message}`);
        // Provide more context for common errors
        if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
            console.error('   Hint: UNPREDICTABLE_GAS_LIMIT often means the transaction will fail on-chain (e.g., revert). Check contract logic or input data.');
        } else if (error.message.includes('insufficient funds')) {
            console.error('   Hint: Insufficient funds in the wallet to cover gas fees.');
        }
        throw error;
    }
}

// --- Main Execution Flow ---

/**
 * Orchestrates the script's execution: prompts for input, parses data,
 * verifies wallet, and calls the contract.
 */
async function main() {
    console.log('
🎯 Validator Re-join Script');
    console.log('='.repeat(60));
    console.log('
This script helps you rejoin the validator set using data from your ZKPassport.');
    console.log('
Instructions:');
    console.log('1. Ensure you have Node.js (v18+) and npm installed.');
    console.log('2. Install ethers.js: `npm install ethers`');
    console.log('3. In your browser\'s developer console (F12), find the error message after clicking "Register" in ZKPassport.');
    console.log('4. Copy the "args:" data (including the "args:" prefix and the entire argument list).');
    console.log('5. Paste the copied "args:" data when prompted below.');
    console.log('6. Enter your private key when prompted.');
    console.log('');

    try {
        // Get wallet private key
        const privateKey = await getUserInput('🔑 Enter your wallet private key: ');
        if (!privateKey) {
            console.error('❌ No private key provided. Exiting...');
            return;
        }

        // Create wallet using ethers v6 syntax
        let wallet;
        try {
            wallet = new ethers.Wallet(privateKey);
            console.log(`✅ Wallet created successfully. Address: ${wallet.address}`);
        } catch (e) {
            throw new Error(`Invalid private key format: ${e.message}`);
        }
        
        // Get and parse arguments data from user input
        console.log('
📋 Paste the "args:" data from your browser console:');
        console.log('   (Press Enter twice when done pasting)');
        const argsInput = await getUserInput('');
        
        const args = parseArgsData(argsInput);
        const extractedData = extractDataFromArgs(args);
        
        console.log('
✅ Data successfully extracted and processed.');
        console.log(`   Attester Address from logs: ${extractedData.attester}`);
        
        // Verify wallet address matches the attester address from logs
        if (wallet.address.toLowerCase() !== extractedData.attester.toLowerCase()) {
            console.warn('
⚠️ WARNING: Wallet address mismatch!');
            console.warn(`   Your provided private key corresponds to: ${wallet.address}`);
            console.warn(`   The attester address from logs is:    ${extractedData.attester}`);
            console.warn('   Ensure you are using the private key for the correct attester address.');
            
            const proceed = await getUserInput('Do you want to proceed anyway? (y/N): ');
            if (proceed.toLowerCase() !== 'y') {
                console.log('❌ Operation cancelled by user.');
                return;
            }
        }
        
        // Call the contract's addValidator function
        const receipt = await callAddValidator(wallet, extractedData);
        
        console.log('
🎉 SUCCESS! Validator re-joined the set!');
        console.log(`   View transaction on Sepolia Etherscan: https://sepolia.etherscan.io/tx/${receipt.hash}`);
        
    } catch (error) {
        console.error('
❌ Script execution failed.');
        console.error(`   Error: ${error.message}`);
        console.log('
💡 Troubleshooting tips:');
        console.log('   - Double-check that you copied the *entire* "args:" data correctly.');
        console.log('   - Ensure your wallet has enough ETH for gas fees on Sepolia.');
        console.log('   - Verify the private key is correct and corresponds to the attester address.');
        console.log('   - Make sure your system has Node.js (v18+) and `ethers` installed (`npm install ethers`).');
        console.log('   - Confirm the ZKPassport data structures match what the contract expects.');
    }
}

// --- Script Entry Point ---

// Check if the script is being run directly.
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        // This catch is for any unhandled rejections from main() itself.
        console.error("Unhandled error during script execution:", error);
        process.exit(1); // Exit with an error code
    });
}

// Export helper functions for potential testing or modular use
export {
    parseArgsData,
    extractDataFromArgs,
    callAddValidator
};
