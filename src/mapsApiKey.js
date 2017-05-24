/* global intializeEfx */
/* global errify */
function getMapsApiKey () {
  
  // the maps api key is in the efx file
  var efx = intializeEfx ();
 
  // get the maps api key
  var keys = efx.getKeys();
  return efx.read (keys.item, keys.updater)
  .then (function (result) {
    if (!result.data.ok) {
        errify ('failed to get item', JSON.stringify (result.data));
    }
    return result.data.value.mapsApiKey;
  });
}
