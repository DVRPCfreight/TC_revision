var map, symbol, selectSymbol, myFeatures;
var streetMap, imageMap, transMap, dvrpc, counts;

var queryTask, queryParams;
// var queryWhere = "RECORDNUM > 0 and AADT >= 0";
var queryWhere = "RECORDNUM > 0";

var mapType = 0;
var toolbar, navToolbar, drawToolbar;

var prevSelect, currSelect;

var mcdlocations = {};
var lastExtent;
var initialExtent;

var locator;

//various util functions
function showLoadingMap() {
  esri.show(dojo.byId('loadingCon'));
//  map.disableMapNavigation();
// map.hideZoomSlider(); 
  }   


function hideLoading() {
  esri.hide(dojo.byId('loadingCon'));
 map.enableMapNavigation();
 map.showZoomSlider(); 
  }   

  
  
function getWhereClause(classname){

  var whereclause = "";
  $(classname).each(function(i, filter){
      var type = $(filter).children(".type").val();
      var reg = typeToRegex(type);
      var fieldname = $(filter).children(".field").val();

      $(filter).children("input[type=text],select")
      .each(function(i, input){
  var value = $(input).val();
  var regnum = /^(NJ|CO|US|PA|RT|RTE|ROUTE)(-|\s)?([0-9]+)/gi.exec(value);
  if (!!regnum)  value = regnum[3];
  if(value.match(reg)){
    if(type=="text"){
      //whereclause += " and " + fieldname + " like '%"+value+"%'";
      whereclause += " and (UPPER("+fieldname+") like '%"+value.toUpperCase()+"%'";
      if (fieldname == 'ROAD') whereclause += " or UPPER(Route) = '"+value.toUpperCase()+"')";
      else whereclause += ')';
    }
    else{
      var dir = (i==0) ? " >= " : " <= ";
      var todate = (i==0) ? 
        "to_date('01/01/"+value+"', 'MM/DD/YYYY')"
        : "to_date('12/31/"+value+"', 'MM/DD/YYYY')";

      if(type=="date"){
        whereclause += " and " + fieldname + dir + todate;
      }
      else{
        whereclause += " and " + fieldname + dir + value;
      }
    }
  }
      });
  });
  console.log(whereclause);
  return whereclause;
}

function typeToRegex(type){
  var regex;
  switch(type){
    case "date":
    {
  regex = /[0-9]{4}/;
    }break;
    case "text":
    {
      regex = /[a-zA-Z0-9]+/;
    }break;
    case "num":
    {
      regex = /[0-9]+/;
    }break;
  }
  return regex;
}

function openTab(tabnum){
  $("#dialog").dialog('open');
  $("#tabs").tabs('select', tabnum);
}


function getExtent(point){
  var delta = 0.025;
  return new esri.geometry.Extent(point.x-delta, point.y-delta, point.x+delta, point.y+delta, new esri.SpatialReference({wkid:102100}));
}

function getMCDExtent(lat, lng){
  var delta = 900.025;
  return new esri.geometry.Extent(lat-delta, lng-delta, lat+delta, lng+delta, new esri.SpatialReference({wkid:102100}));
}

function zoomToExtent(extent){
  map.setExtent(extent);
}

function zoomExtent() {
  map.setExtent(initialExtent,true);
}

function changeBaseMap(type){
  if(type != mapType){
    if(mapType==0){
      mapType = 1;
      streetMap.hide();
      imageMap.show();

    transMap.show();
    }
    else{
      mapType=0;
      imageMap.hide();

    transMap.hide();
      streetMap.show();
    }
  }
} 

function extentHistoryChangeHandler() {
  dijit.byId("zoomprev").disabled = navToolbar.isFirstExtent();
  dijit.byId("zoomnext").disabled = navToolbar.isLastExtent();
}

function openTab(tabnum){
  $("#dialog").dialog('open');
  $("#tabs").tabs('select', tabnum);
}

function openTab2(){
  $("#dialog2").dialog('open');
}
$(document).ready(function(){

  $("#sidebar").accordion({
    fillSpace : true,
    active : 0,
    collapsible: true
  });
  
   $("#dialog").dialog({
    autoOpen: true,
    modal:true,
    dialogClass : 'dialog',
    open : function(event, ui){
      $("#tabs").tabs();
    }
  });
  
  $("#dialog2").dialog({
    autoOpen: false,
    modal:true,
    dialogClass : 'dialog2'
  
  });
  
  $("#popupDiv").dialog({
    modal:true,
    dialogClass : 'dialog',
  autoOpen: false
  
  });

  $(".buttons").button();
  $("#queryLastExtent").click(function(){
    identifyExtent(lastExtent);
  });
  
  $("#clearInputs").click(function(){
    $(".filter").find("input[type=text]").val("");
  });
  
   $('.noticeLink').live('click',function() {
  $('#popupDiv').dialog('open');
  });
  
   //get mcd data from csv and populate tree
  $.get("data/mcddata_utm.csv", function(data){
    var arrs = $.csv()(data);
    var dataObj = {};
    $(arrs).each(function(index, line){
      if(typeof(dataObj[line[1]]) == "undefined"){
  dataObj[line[1]] = {data:{title:line[1], href:"#"},children:[]};
      }
      dataObj[line[1]].children.push(
  {data:
    {
      title:line[2],
      attr:{
        href:"javascript:zoomToExtent(getMCDExtent("+line[4]+","+line[3]+").expand("+line[5]+"));void(0);"
      }
    }
  });
    });
    var data = [];

    for(county in dataObj){
      if(county!="undefined"){
  data.push(dataObj[county]);
      }
    }
$("#tree").jstree({
    "themes" : {
      "theme" : "classic",
      "dots" : false,
      "icons" : false
    },
    "json_data" : {
      "data" : data
    },
    "plugins" : [ "themes", "json_data" ]
  });
  
  });



  // manually convert UTC date to m/d/y
   function frmDate(v){
      var d, mm, dd;
        if (v) {
            d = new Date(v);
            mm = d.getUTCMonth() + 1;
            dd = d.getUTCDate();
            return (((mm < 10) ? "0" + mm : mm) + "/" +
                    ((dd < 10) ? "0" + dd : dd) + "/" +
                    d.getUTCFullYear());
        }
        else {
            return "";
        }
   }
  //Jqgrid
// datefmt : "n/j/Y"
    var colModel = [
     {name:'SETDATE', index:'SETDATE', sorttype:"date", formatter:frmDate, formatoptions: {newformat:'m/d/Y'}, datefmt: 'd-M-Y', width:95, label:"Date of Count"},
      {name:'Details Link', index:'Details Link', label:"Detailed Report", width:90},
      {name:'RECORDNUM', index:'RECORDNUM', width:75, label:"DVRPC File #"},
       {name:'TYPE', index:'TYPE',width:120, label:"Type"},
    {name:'AADT', index:'AADT',width:55, label:"AADT",sorttype:"number", formatter:"number",formatoptions:{thousandsSeparator: ",",decimalPlaces:"0"}},
      {name:'MUN_NAME', index:'MUN_NAME',width:110, label:"MCD"},
      {name:'ROUTE', index:'ROUTE',width:110, label:"Route #"},
      {name:'ROAD', index:'ROAD', width:115, label : "Road"},
      {name:'CNTDIR', index:'CNTDIR',width:90, label:"Count Direction"},
      {name:'FROMLMT', index:'FROMLMT',width:120, label:"From"},
      {name:'TOLMT', index:'TOLMT', width:120, label:"To"}  
    ];

 //   var colNames =["Road", "Date of Count", "DVRPC File #", "AADT", "Count Direction", "From", "To", "MCD", "County"];

   var grid= jQuery("#results").jqGrid({
      datatype : "clientSide",
      height : 150,
//      colNames : colNames,
      colModel : colModel,
      caption : "Traffic Count Info (max 500 records) | ",
//      autowidth:true,
      multiselect : false,
      onSelectRow : function(id){
        var feature = myFeatures[id];
        feature.setSymbol(symbol);

        if(prevSelect!== null){
          prevSelect.setSymbol(selectSymbol);
    map.graphics.add(prevSelect);
        }
        prevSelect= feature;

        map.graphics.add(feature);
        map.setExtent(getExtent(feature.geometry));
      }
    });

    //jQuery("#results").jqGrid('filterToolbar',{autosearch:true});

    $("#results").fluidGrid({example:"#body",offset:-2});

    var headerArr =[];
    $(colModel).each(function(i,val){headerArr.push(val.label);});
    var exportLink = $("<a></a>").attr("innerHTML", "Export Table")
      .attr("href", "javascript:void(0);")
      .click(function(){
  var results = $("#results").clone();
  //$(results).find("td[title=Details]").remove();
  var csvdata = $(results).table2CSV({header:headerArr, delivery:"value"});
  $.doPost(
    "http://www.dvrpc.org/asp/US30CorridorStudy/route30_data.aspx",
    {"p":"getcsv", "content":csvdata});
      });
    $(".ui-jqgrid-title").append(exportLink);
    //}}}

});

  function init() { 
  
  initialExtent = new esri.geometry.Extent({"xmin":-8502778.91,"ymin":4784652.06,"xmax":-8227605.61,"ymax":4968100.93,"spatialReference":{"wkid":102100}}).expand(1);
  lastExtent = initialExtent;

  map = new esri.Map("map", { extent: initialExtent });
  
    
   dojo.connect(map,"onUpdateStart",showLoadingMap);
  
   dojo.connect(map,"onUpdateEnd",function(){
       esri.hide(dojo.byId('loadingCon'));
     });
  
  dojo.connect(map, 'onLoad', createToolbar);  

//  dojo.connect(map,"onUpdateStart",showLoadingMap);
//  dojo.connect(map,"onUpdateEnd",hideLoadingMap);
        
  streetMap = new esri.layers.ArcGISTiledMapServiceLayer(
    "http://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer", 
    {id:"streetMap", visible:true}
  );
  map.addLayer(streetMap);

  imageMap = new esri.layers.ArcGISTiledMapServiceLayer(
    "http://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer", 
    {id:"imageryPrime", visible:false}
  );
  map.addLayer(imageMap);
 
  
   transMap = new esri.layers.ArcGISTiledMapServiceLayer(
     "http://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer",
  {id:"transMap", visible:false,"opacity":0.85}
  );
  map.addLayer(transMap);

  dvrpc = new esri.layers.ArcGISDynamicMapServiceLayer(
    "http://gis.dvrpc.org/ArcGIS/rest/services/DVRPC_Traffic_Counts/MapServer"
  );
  map.addLayer(dvrpc);
  dvrpc.setVisibleLayers([0,1]);

  //Traffic counts
  counts = new esri.layers.ArcGISDynamicMapServiceLayer(
    "http://arcgis.dvrpc.org/arcgis/rest/services/Transportation/TrafficCounts/MapServer/"
    // "http://gis.dvrpc.org/ArcGIS/rest/services/DVRPC_Traffic_Counts/MapServer"
  );
  map.addLayer(counts);
  // counts.setVisibleLayers([2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17]);
  counts.setVisibleLayers([0]);
  
  dojo.connect(counts, "onError", function(error){
  alert ("There was an issue loading the traffic counts, please refresh webpage thank you!");
  });  

  //query task setup
  queryTask = new esri.tasks.QueryTask(
    // "http://gis.dvrpc.org/ArcGIS/rest/services/DVRPC_Traffic_Counts/MapServer/18"
    "http://arcgis.dvrpc.org/arcgis/rest/services/Transportation/TrafficCounts/MapServer/0"
    );

  queryParams = new esri.tasks.Query();
  queryParams.returnGeometry = true;
  queryParams.outFields = ["ROAD", "SETDATE", "RECORDNUM", "AADT", "CNTDIR", "FROMLMT", "TOLMT", "MUN_NAME", "ROUTE","TYPE"];
  queryParams.where = queryWhere;

  //adding identify onclick
  dojo.connect(map, "onClick", identifyPoint);
  dojo.connect(queryTask, "onComplete", hideLoading); 

  //map symbols setup
  symbol = new esri.symbol.SimpleMarkerSymbol();
  symbol.setSize(10);
  symbol.setColor(new dojo.Color([255,255,0]));

  selectSymbol =new esri.symbol.SimpleMarkerSymbol(esri.symbol.SimpleMarkerSymbol.STYLE_SQUARE, 12,
   new esri.symbol.SimpleLineSymbol(esri.symbol.SimpleLineSymbol.STYLE_SOLID,
   new dojo.Color([0,255,197]), 1),
   new dojo.Color([255,0,0,0]));

}
  
       
function createToolbar(map){
    toolbar = new dijit.Toolbar({},"navToolbar");
    navToolbar = new esri.toolbars.Navigation(map);
    drawToolbar = new esri.toolbars.Draw(map);

    dojo.connect(drawToolbar, "onDrawEnd", identifyExtent);

    dojo.connect(navToolbar, "onExtentHistoryChange", extentHistoryChangeHandler);

    var fullExtent = new dijit.form.Button({
      label : "Zoom to Region",
      id : "zoomfullext",
      iconClass : "regionIcon",
      onClick : function(){zoomExtent();}
    });
    toolbar.addChild(fullExtent);

    var prevExtent = new dijit.form.Button({
      label : "Prev Extent",
      id : "zoomprev",
      iconClass : "zoomprevIcon",
      onClick : function(){navToolbar.zoomToPrevExtent();}
    });
    toolbar.addChild(prevExtent);


    var nextExtent= new dijit.form.Button({
      label : "Next Extent",
      id : "zoomnext",
      iconClass : "zoomnextIcon",
      onClick : function(){navToolbar.zoomToNextExtent();}
    });
    toolbar.addChild(nextExtent);

    var boxSelect = new dijit.form.Button({
      label : "Select",
      id : "selectButton",
      iconClass : "selectIcon",
      onClick : function(){$("#selectButton").addClass("dijitButtonHover"); drawToolbar.activate(esri.toolbars.Draw.EXTENT);}
    });
    toolbar.addChild(boxSelect);

     var erase = new dijit.form.Button({
      label : "Clear",
      iconClass : "clearIcon",
      onClick : function(){map.graphics.clear();
          jQuery("#results").clearGridData();
           $(".ui-jqgrid-numberResults").remove();
      var jqGridNumber = $("<span></span>").addClass("ui-jqgrid-numberResults")
      .attr("innerHTML", " | Results: 0");
      $(".ui-jqgrid-title").append(jqGridNumber);
}
    });
    toolbar.addChild(erase);

    var blank = new dijit.form.Button({
      label : "    "
    });
    toolbar.addChild(blank);


    var street= new dijit.form.Button({
      label : "Map",
      iconClass : "streetmapIcon",
      onClick : function(){changeBaseMap(0);}
    });
    toolbar.addChild(street);

    var image= new dijit.form.Button({
      label : "Satellite",
      iconClass : "satIcon",
      onClick : function(){changeBaseMap(1);}
    });
    toolbar.addChild(image);

  }
//identifyextent

function identifyExtent(extent){
  $("#selectButton").removeClass("dijitButtonHover");
    esri.show(dojo.byId('loadingCon'));
  drawToolbar.deactivate();
//  esri.show(dojo.byId("loadingImg"));
  map.disableMapNavigation();
  map.hideZoomSlider();

  map.graphics.clear();

  map.setExtent(extent.expand(1), true);

  queryParams.geometry = extent;

  var resultsFunction = addResults(true);

  var whereFilter = getWhereClause(".filter");
  queryParams.where = queryWhere + whereFilter;

  lastExtent = extent;

  queryTask.execute(queryParams, resultsFunction);
}

//identify point

function identifyPoint(evt){

    esri.show(dojo.byId('loadingCon'));
 // esri.show(dojo.byId("loadingImg"));
  map.disableMapNavigation();
  map.hideZoomSlider();

  map.graphics.clear();
  
  var pixelWidth = map.extent.getWidth() / map.width;

  //calculate map coords for tolerance in pixel
  var toleraceInMapCoords = 5* pixelWidth;

  //calculate & return computed extent
  var point = evt.mapPoint;

  var queryExtent = new esri.geometry.Extent( 
    point.x - toleraceInMapCoords,
    point.y - toleraceInMapCoords,
    point.x + toleraceInMapCoords,
    point.y + toleraceInMapCoords,
    map.spatialReference 
  );

  queryParams.geometry = queryExtent;
  
  var resultsFunction = addResults(true);

  //var whereFilter = getWhereClause(".filter");
  queryParams.where = queryWhere;
  // + whereFilter;

  queryTask.execute(queryParams, resultsFunction);
}


//callback for identify execute to add results to grid
function addResults(showPoint){
  return function(results){
    // console.log(results);
    var attributes = ["ROAD", "SETDATE", "RECORDNUM", "AADT", "CNTDIR", "FROMLMT", "TOLMT", "MUN_NAME", "ROUTE","TYPE"];

    jQuery("#results").clearGridData();
    window.scroll(0, 100);

    $(".ui-jqgrid-numberResults").remove();
    var jqGridNumber = $("<span></span>").addClass("ui-jqgrid-numberResults")
      .attr("innerHTML", " | Results: " + results.features.length);

    $(".ui-jqgrid-title").append(jqGridNumber);

    myFeatures={};

    prevSelect= null;
    $(results.features).each(function(num, result){

      //var feature = result.feature;
      var datum = {};

    $(attributes).each(function(i, attr){
      console.log(result.attributes);
      if(attr == "SETDATE" && result.attributes[attr] !== null){
        datum[attr] = result.attributes[attr];
        // .split(" ")[0];
      }
      else{
        datum[attr] = result.attributes[attr];
      }
    });

    datum["Details Link"] = (datum["TYPE"] == "Turning Movement" || datum["TYPE"] == "Manual Class" || datum["TYPE"] == "Crosswalk") ?  "<a target='_blank' href='http://www.dvrpc.org/asp/TrafficCountPDF/"+datum["TYPE"]+"/"+datum["RECORDNUM"]+".pdf'>Report</a>" :  "<a target='_blank' href='http://www.dvrpc.org/asp/trafficCount/default.aspx?recnum="+datum["RECORDNUM"]+"'>Report</a>";
    jQuery("#results").addRowData(num+1,datum);
      myFeatures[num+1] = result;

      if(showPoint){
  var feature = result;
  feature.setSymbol(selectSymbol);
        map.graphics.add(feature);
      }
    });
  }
}

//src: http://stackoverflow.com/questions/1149454/non-ajax-get-post-using-jquery-plugin

(function($) {
    $.extend({
        getGo: function(url, params) {
            document.location = url + '?' + $.param(params);
        },
        doPost: function(url, params) {
            var $form = $("<form>")
                .attr("method", "post")
                .attr("action", url);
            $.each(params, function(name, value) {
                $("<input type='hidden'>")
                    .attr("name", name)
                    .attr("value", value)
                    .appendTo($form);
            });
            $form.appendTo("body");
            $form.submit();
        }
    });
})(jQuery);

dojo.addOnLoad(init);