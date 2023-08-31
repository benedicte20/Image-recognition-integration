import functions, { firebaseConfig } from "firebase-functions";
const funCall = functions.region("europe-west1");
import { getStorage, deleteFromStorage} from "../components/storage.js";

import vision from '@google-cloud/vision';

const client = new vision.ImageAnnotatorClient({
  keyFilename: '../Keys.json'
});

/**
 * Cloud Function to determine if an image contains receipt information.
 * @param {Object} data - Data passed to the function. It should contain the 'fileName'.
 * @returns {Object} - Returns an object with a 'isReceipt' property indicating whether the 
 * image contains receipt information or not.
 */

export const RequestManager =  funCall.https.onCall(async ( data ) => {
 try {
      // Get the Firebase project ID
      const { projectId } = firebaseConfig();

     // Construct the file path for the image in Cloud Storage
      let filePath = `receipts/${data.fileName}`;

      // Check if the file exists in Cloud Storage
     await getStorage(filePath);

      // Create the full path of the file in Cloud Storage
      let fileFullPath = `gs://${projectId}.appspot.com/${filePath}`;
      
       // Perform text detection on the image
      let [ results ]  = await client.textDetection(fileFullPath);

      // Check if the image has any text detected
      if(!results || !results.textAnnotations || results.textAnnotations.length === 0){
        // If no text found, throw an error
        errorHandler("missingText",'Image does not contain any text to process.!');
      }

      // Extract relevant data from the detected text
      let annotations = results.textAnnotations;
      let extractedData = ResponseAnalyzer(annotations[0]);

      // Determine if the image contains receipt information
      const isReceipt = extractedData.containsTotal && extractedData.containsDate && extractedData.containsMoms;

      if(!isReceipt){
         // If the image does not contain receipt information, delete the image from Cloud Storage
         await deleteFromStorage(filePath);
       // Throw an error 
       errorHandler("notReceipt",'Image does not seem to be a receipt.');
      } 
      // Return the result indicating if it's a receipt or not
      return { success: true, isReceipt };
 } catch (error) {
  // If any error occurs, throw an error
  errorHandler("other", error.message)
 }  
});

/**
 * Extract the relevant receipt information from the data extracted from the image.
 * @param {Object} data - The data extracted from the image.
 * @returns {Object} - Returns an object with properties indicating whether 'total', 'moms', and a valid 'date' are present in the text.
 */

const ResponseAnalyzer = function(data){

  const text = data.description.toLowerCase();

  // Check if 'total' and 'moms' are present in the detected text
  const containsTotal = text.includes('total');
  const containsMoms = text.includes('moms');

  // Regular expression to match dates in the format YYYY-MM-DD
  const dateRegex = /[1-9][0-9]{3}-([0][1-9]|[1][0-2])-([1-2][0-9]|[0][1-9]|[3][0-1])/m;

  // Check if a date is present in the detected text
  const containsDate = dateRegex.test(text);

  return { containsTotal, containsMoms, containsDate };  
}

/**
 * Error handling function for throwing custom Cloud Function errors.
 * @param {string} name - The name of the error.
 * @param {string} message - The error message.
 */
const errorHandler = function (name, message) {
  if (name === 'missingText' || name === 'notReceipt') {
    // Throw a 'not-found' error if the text is missing or image is not a receipt
    throw new functions.https.HttpsError('not-found', message);
  } else {
    // Throw an 'internal' error for other errors
    throw new functions.https.HttpsError('internal', message);
  }
};



