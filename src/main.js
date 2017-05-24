/* global google */
/* global Maps */
/* global EffexApiClient */
/* global getMapsApiKey */
/* global getEfxKeys */


function intializeEfx() {
  // connect to cache
  var efx = EffexApiClient;
  efx.setEnv('prod');

  // this particular app is expecting to read and update an item, so ensure we have keys for that
  // they will have been on the command line
  if (!efx.checkKeys(["updater", "item"])) {
    errify('missing  parameters', ' an updater key and an item key are required');
  }

  return efx;
}

window.onload = getMapsApiKey()
  .then(function(apiKey) {
    google.load('maps', '3', {
      callback: function() {

        // and any uri keys found will already have been set
        var efx = intializeEfx();
        var keys = efx.getKeys();

        var maps;

        // give some info 
        document.getElementById("efx-id").innerHTML = EffexApiClient.getKeys().item;
        document.getElementById("efx-key").innerHTML = EffexApiClient.getKeys().updater;

        
        // and get the data
        efx.read(keys.item)
          .then(function(response) {
            if (response.data && response.data.ok) {

              // initialize the map and get going
              var value = response.data.value;
              document.getElementById("efx-name").innerHTML = value.keys.name;

              // get going
              maps = new Maps().init(value);
            }
            else {
              errify("Failed to get effexdata", JSON.stringify(response));
            }
          })
          .catch(function(err) {
            errify("grevious error getting data", err);
          });

        // start watching for updates
        efx.on("update", keys.item, keys.updater, function (id, packet) {

            efx.read (keys.item)
            .then (function (result) {
              if (!result.data.ok) {
                errify ("couldnt get item after push", JSON.stringify(result.data));
              }
              else {
                maps.orchestrate (result.data.value);
              }
            });
          }, {
          type: "push"
        });
      },


      other_params: 'key=' + apiKey

    });
  });



// error messages
function errify(message, error) {
  var ef = document.getElementById("errify");
  ef.classList.remove("mui--hide");
  ef.innerHTML = message + '<br>' + error;
  console.log(message, error);
  setTimeout(function() {
    ef.classList.add("mui--hide");
  }, 5000);
}
