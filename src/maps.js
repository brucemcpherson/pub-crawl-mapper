/*global google*/
/*global errify*/
/*global getMapsApiKey*/

/**
 * @constructor Maps
 * all maps type things will be done here
 */
var Maps = function() {
  var ns = this;

  // the map
  ns.map = null;

  // the spots known
  ns.spots = [];

  // e need thes to be able to clear them later
  ns.markers = [];

  // all the info for each known route
  ns.routes = {};

  /**
   * remove a spot
   * @param {object} spot the place
   */
  ns.removeSpot = function(spot) {
    ns.spots = ns.spots.filter(function(d) {
      return spot.maps.id !== d.maps.id;
    });

  };

  /**
   * make an infowindow
   * @param {object} spot a place
   * @return {infoWindow} the infowindow
   */
  ns.makeInfoWindow = function(spot) {
    var place = spot.place;
    var marker = spot.maps.marker;
    ns.activeSpot = spot;

    var content = '<div>';


    content += '<div class="mui-textfield">';
    content += '<input type="text" id="ttitle" value="' + place.title + '" cols="40" />';
    content += '<label>Title</label>';
    content += '</div>';
    content += '<div class="mui-textfield"><textarea id ="tinfo" rows="4" cols="40">' + place.info + '</textarea><label>Info</label></div>';

    content += '<div class="mui-textfield">';
    content += '<input type="text" id="taddress" value="' + place.address + '" cols="40" />';
    content += '<label>Address</label>';
    content += '</div>';

    content += '<div class="mui-textfield">';
    content += '<input type="text" disabled id="tclean" value="' + place["clean address"] + '" cols="40" />';
    content += '<label>Formatted address</label>';
    content += '</div>';

    content += '<button class="mui-btn mui-btn--primary" id="tsave">SAVE</button> <button class="mui-btn mui-btn--danger" id="tremove">REMOVE</button>';

    content += '<span class="mui--pull-right"><i id="tstreetview" class="material-icons">streetview</i></span>';
    content += '</div>';

    // im contructing the element so that I can find the button elements i just made
    var elem = document.createElement("div");
    elem.innerHTML = content;



    ns.infoWindow.setContent(elem);
    return ns.infoWindow;

    function findElem(elem, id) {
      // are we there yet?
      if (elem.id === id) return elem;
      var node = null;

      // look at the children
      (elem.hasChildNodes() ? Array.prototype.slice.call(elem.childNodes) : [])
      .forEach(function(d) {
        if (!node) node = findElem(d, id);
      });
      return node;
    }
  };

  /** 
   * given a set of points, make a route
   * @param {object[]} markers the markers
   */
  ns.calculateRoute = function(route) {

    // make the way points
    var points = route.complete
      .map(function(d) {
        return {
          location: {
            placeId: d.placeid
          },
          stopover: true
        };
      });

    var wayPoints = points.slice(1, points.length - 1);

    return new Promise(function(resolve, reject) {
      ns.directionsService.route({
        origin: points[0].location,
        destination: points[points.length - 1].location,
        travelMode: "WALKING",
        waypoints: wayPoints,
        optimizeWaypoints: true
      }, function(response, status) {
        resolve({
          response: response,
          status: status
        });
      });
    });


  };


  /**
   * plot all the places on the map
   * @param {object[]} points the points
   */
  ns.makePositions = function(points) {

    return points.map(function(d) {
      return {
        marker: new google.maps.Marker({
          position: {
            lat: d.lat,
            lng: d.lng
          },
          map: ns.map,
          title: d.name || "",
          draggable: true,
          animation: google.maps.Animation.DROP
        }),
        point: d
      };

    });

  };



  /**
   * make an elem visible
   */
  ns.showElem = function(item, show) {
    document.getElementById(item).classList[show ? 'remove' : 'add']("mui--hide");
  };

  /**
   * get computed style
   */
  ns.getComputedStyle = function(item) {
    return window.getComputedStyle(document.getElementById(item));
  };


  /*
   * initialize the app and add listeners
   * @param {[object]} data the data from the store
   */
  ns.init = function(data) {

    // Construct the polygon.
    var scope = new google.maps.Polygon({
      paths: data.polygon,
      strokeColor: '#FF9800',
      strokeOpacity: 0.3,
      strokeWeight: 2,
      fillColor: '#FF9800',
      fillOpacity: 0.2
    });

    var elem = document.getElementById('map');
    ns.map = new google.maps.Map(elem, {
      mapTypeId: 'roadmap'
    });

    // we'll be using the directions service
    ns.directionsService = new google.maps.DirectionsService;

    // and set the bounds for the polygon
    var bounds = new google.maps.LatLngBounds();
    data.polygon.forEach(function(d) {
      bounds.extend(d);
    });
    ns.map.fitBounds(bounds);

    // plot the region
    scope.setMap(ns.map);

    // set up any elems
    ns.setElems();

    // do the work
    ns.orchestrate(data);
    return ns;
  };

  // set up any elements
  ns.setElems = function() {
    ns.select = document.getElementById("pub-crawl-selector");

    // add an event handler
    google.maps.event.addDomListener(ns.select, "change", function(e) {
      ns.displayRoutes(0, true);
      ns.showWayPoints();
    });
  };

  // load new routes data to ns.routes
  // .arrived will be set to now if new or changed
  // .loaded will be set to now
  ns.routeChanges = function(newData, now) {

    document.getElementById("data-name").innerHTML = newData.name;
    // load the crawls and note changes
    newData.crawls
      .forEach(function(d) {
        var name = d['crawl-name'];
        var color = d.color;
        
        // find the components for this route
        var complete = newData.complete.filter(function(e) {
          return e.crawl === name;
        });

        // add if its new
        var p = ns.routes[name];
        if (!p) {
          // this is the first time we're seeing it
          p = ns.routes[name] = {};
          p.arrived = now;
          p.complete = complete;
          p.color = color;
        }

        // there could be changes
        else if (p.color !== color || p.complete.length !== complete.length || p.complete.some(function(e, i) {
            return e.placeid !== complete[i].placeid;
          })) {
          p.arrived = now;
          p.complete = complete;
          p.color = color;
        }

        p.loaded = now;
      });
  };

  // Adds a custom direction marker to the map.
  function makeMarker(location, idx) {

    ns.markers.push(new google.maps.Marker({
      position: location,
      label: String.fromCharCode(65 + idx),
      map: ns.map
    }));

  }

  // clear markers
  function clearMarkers() {
    ns.markers.forEach(function(d) {
      d.setMap(null);
    });
  }

  /**
   * we have the routes, and know if they have changed
   * now calculate routes and display as required
   */
  ns.displayRoutes = function(now, force) {


    // so now we know which ones need to be invalidated and which ones need plotting
    return Object.keys(ns.routes)
      .map(function(k) {

        var p = ns.routes[k];

        // these have gone away
        if (now && p.loaded !== now) {
          if (p.display) p.display.setMap(null);
          ns.routes[k].delete;
          return Promise.resolve(null);
        }


        // these are new or need redoing
        else if (force || (now && p.arrived === now)) {

          // clear the current
          if (p.display) p.display.setMap(null);

          var active = k === ns.select.value;

          // selected value gets highlighted
          var options = !active ? {
            polylineOptions: {
              zIndex: 10,
              strokeOpacity: .2,
              strokeColor: p.color
            }
          } : {
            polylineOptions: {
              zIndex: 20,
              strokeOpacity: 1,
              strokeColor: p.color
            }
          };
          // make my own markers
          options.suppressMarkers = true;

          p.display = new google.maps.DirectionsRenderer(options);
          p.display.setMap(ns.map);

          // calculate the route, then show it
          // only needed if we don't already have a response
          var rp;
          if (p.response && p.status === "OK") {
            rp = Promise.resolve(p);
          }
          else {
            rp = ns.calculateRoute(p);
          }


          return rp.then(function(result) {

              p.status = result.status;
              p.response = result.response;

              if (p.status === "OK") {
                p.display.setDirections(p.response);
              }
              else {
                errify('Directions request failed', p.status);
              }
              return p;
            })
            .catch(function(err) {
              errify('Directions request error', err);
            });
        }


        else return Promise.resolve(null);

      });

  };

  ns.orchestrate = function(newData) {

    // received a notification of update
    var now = new Date().getTime();

    // load and find any changed items
    // im doing this rather than just redoing the whole thing every time
    // to minimize quota usage
    ns.routeChanges(newData, now);

    // make the selector
    ns.makeSelect();

    // calculate and display the routes
    Promise.all(ns.displayRoutes(now))
      .then(function() {
        // show waypoints for selected route
        ns.showWayPoints();
      });


    // add the unassigned routes


  };

  // show the selected waypoints
  ns.showWayPoints = function() {
    
    var sv = ns.select.value;
    var ul = document.getElementById('pub-crawl-waypoints');
    ul.innerHTML = "";

    // show them in order
    if (sv && ns.routes[sv] && ns.routes[sv].response) {

      // kill the old markers
      clearMarkers();
          
      // create a map for the order of the waypoints compared to the original route data
      // we can use the geocoded_waypoints placeid to find in the original
      var rs = ns.routes[sv].response;
      var legs = rs.routes[0].legs;
      
      // adjust bounds for this route this doesnt work too well
      ///ns.map.fitBounds(rs.routes[0].bounds);
      
      var complete = ns.routes[sv].complete;
      if (legs.length !== rs.geocoded_waypoints.length -1) {
        console.log ("expected legs length to be 1 less that waypoints length",legs.length,rs.geocoded_waypoints.length );
      }
      // this will contain a sorted version of the original places to match the waypint order
      rs.geocoded_waypoints.map(function(c,j) {
        var p = complete.filter(function(e) {
          return e.placeid === c.place_id && c.geocoder_status === "OK";
        })[0];
        if (!p) {
          console.log("couldnt find placeid" && c.place_id);
        }
        var l = legs[j] ;
        var ll = legs[legs.length-1];
        p.legPoint = {
          location:l ? l.start_location : ll.end_location,
          duration:l ? l.duration.text : "",
          address:l ? l.start_address : ll.end_address
        };
        return p;
      })
      
      // and get rid of duplicates (sometimes waypoints contain repetitions)
      .filter (function (d,i,a) {
        var dup = a.slice(i+1).filter (function (e) {
          return e.placeid === d.placeid;
        })[0];
        // copy forward info from the first occurrence
        if (dup) {
          dup.legPoint.duration = (d.legPoint.duration ? d.legPoint.duration  + "+" : "") + dup.legPoint.duration;
        }
        return !dup;
      })

      // finally, add labels
      .map (function (r,i) {
        
        // make my own marker
        var p = r.legPoint;
        makeMarker (p.location , i);
        var c = "<strong>" + String.fromCharCode(65 + i) + ". " + r.name + '</strong><span style="font-size:.8em;">' + 
          "<br>" + p.address + (p.duration ? ('<br /><i class="material-icons">directions_walk</i>' + p.duration + "</span>") : "");

        var li = document.createElement("li");
        ul.appendChild(li);
        li.innerHTML = c;
          
      });

    }
  };

  // make a select for the known routes
  ns.makeSelect = function() {

    var v =  ns.select.value ;
    ns.select.innerHTML = "";
    Object.keys(ns.routes)
      .forEach(function(d) {
        if (d) {
          var option = document.createElement("option");
          option.innerHTML = d;
          option.value = d;
          ns.select.appendChild(option);
          v= v || d;
        }
      });

    // set default value if necessary
    if (v !== ns.select.value) {
      ns.select.value = v;
    }
    return ns.select;

  };

  // Adds a marker to the map and push to the array.
  ns.addMarker = function(place) {

    try {
      // make a marker for this place
      var marker = new google.maps.Marker({
        position: {
          lat: place.lat,
          lng: place.lng
        },
        map: ns.map,
        title: place.title || "",
        draggable: true,
        animation: google.maps.Animation.DROP
      });


      // add it to the data
      var spot = {
        maps: {
          marker: marker,
          id: new Date().getTime().toString(32) + Math.random(),
          sv: null
        },
        place: place
      };

      // if there's a view parameter, decode it and extract the current parameters
      if (place.view) {
        spot.maps.view = ["pano", "pitch", "heading", "fov"].reduce(function(p, c) {
          var match = RegExp('[?&]' + c + '=([^&]*)').exec(place.view);
          p[c] = match && decodeURIComponent(match[1].replace(/\+/g, ' '));
          return p;
        }, {});

        // now generate an active pano object using those params

        // estimate  the zoom 
        var fov = parseFloat(spot.maps.view.fov);
        var zoom = 1 - Math.log(Math.tan(fov * Math.PI / 360)) / Math.log(2);

        spot.maps.sv = {
          pano: spot.maps.view.pano,
          pov: {
            zoom: zoom,
            heading: parseFloat(spot.maps.view.heading),
            pitch: parseFloat(spot.maps.view.pitch)
          }
        };
      }

      // make it clickable
      google.maps.event.addListener(spot.maps.marker, "click", function() {
        ns.makeInfoWindow(spot).open(ns.map, spot.maps.marker);
      });

      //  handle what happens if a marker is dragged
      google.maps.event.addListener(spot.maps.marker, "dragend", function() {
        // if a drag happens then the clean address is changed, the address is not.
        var pos = spot.maps.marker.getPosition();

        // do a reverse geocode
        ns.reverseGeoCode(pos)
          .then(function(address) {
            spot.place.lat = parseFloat(pos.lat);
            spot.place.lng = parseFloat(pos.lng);
            spot.place["clean address"] = address;
            // make everything fit
            ns.resetBounds();

            // if there's an active spot, then it needs refreshing
            ns.makeInfoWindow(spot);

          })
          .catch(function(err) {
            errify('reverse geocode failure', err);
          });


      });

      ns.spots.push(spot);
    }
    catch (err) {
      errify("data invalid for " + place.title, err);
    }
  };


};
