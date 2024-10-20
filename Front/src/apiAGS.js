// apiAGS.js

export async function saveCollectionParams(dbName, opt) {
    try {
      const payload = {
        dbName,
        collectionId: opt._id,  
        P0: opt.P0,
        P1: opt.P1,
      };
  
      const response = await fetch('/save_collection_params', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
  
      if (!response.ok) {
        throw new Error('Failed to save collection parameters');
      }
  
      const responseBody = await response.text();
      console.log(responseBody);
      return { success: true, message: responseBody };
    } catch (error) {
      console.error('Error saving collection params:', error);
      return { success: false, message: error.message };
    }
  }
  