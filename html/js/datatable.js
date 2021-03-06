/*
datatable.js
Author: James Holland jholland@usgs.gov
datatable.js contains functions functions for the datatable found on both summary and station modes.
License: Public Domain
*/

var dTable; //DataTable object used throughout

var dTableAjaxMan = $.manageAjax.create('dTableAjaxMan',
    {
        queue: false,
        cacheResponse: false
    }
);

function bindTableActions() {
    dTable.find('tbody td').click(function(){
        var id = $(this).attr('id');
        if(id != undefined){
            if(id != undefined && id.charAt(0) == 'd')
                createDialog(id);
            else if(id.charAt(0) == 'l'){
                window.location = 'dataq.html?station='+id.split('_')[1]
                +'&sdate='+getStartDate('simple')
                +'&edate='+getEndDate('simple')
                +'&tdate='+getDateType();
            }
        }
    });

    //Highlight row
    $('#grid tbody').on('mouseenter', 'tr', function(){
        $(this).addClass('rowSelected');
    }).on('mouseleave', 'tr', function(){
        $(this).removeClass('rowSelected');
    });
}

function clearTable(){
    var rows = dTable.fnGetNodes();
    for( var i = 0; i<rows.length; i++){
        $(rows[i]).find("td").each(function(){
            var pos = dTable.fnGetPosition(this);
            if(String($(this).attr("id")).charAt(0) == "d"){ //only clear data cells 
                dTable.fnUpdate("", pos[0], pos[2], false, false); 
            }
            if(String($(this).attr("id")).charAt(0) == "a"){
                dTable.fnUpdate(parseFloat(0), pos[0],pos[2], false, false);
            }

        });
    }
}

function buildTable(){
    var dataGrid = document.getElementById("grid");
    var metricsSorted = new Array();
    var metrics = new Array();
    var gridhead = $("#grid thead tr");
    for(header in mapMNametoMID) {
        if(mapMNametoMID.hasOwnProperty(header)) {
            metrics.push(header);
        }
    }
    metricsSorted = metrics.sort(naturalSort);
    if(pageType =="summary"){

        gridhead.append('<th id="network">Network</th>');
        gridhead.append('<th id="Station">Station</th>');
        gridhead.append('<th id="groups">Groups</th>');
        for( var i = 0; i<metricsSorted.length; i++){
            gridhead. append('<th id="'+mapMNametoMID[metricsSorted[i]]+'">'+metricsSorted[i]+'</th>');
        }
        gridhead.append('<th id="aggregate">Aggregate</th>');

        for(station in mapSIDtoNID){
            if(mapSIDtoNID.hasOwnProperty(station)){
                var row = $(
                    '<tr id = "'+station+'"><td>'+mapGIDtoGName[mapSIDtoNID[station]]+'</td>'
                    +'<td id="l_'+station+'" class="ltd">'+mapSIDtoSName[station]+'</td>'
                    +'<td>,'+mapSIDtoGIDs[station]+',</td></tr>'
                );
                //Adding 1.01 causes datatables to automatically set the column types to numeric
                for( var i = 0; i<metricsSorted.length; i++){
                    row.append('<td id="d_'+mapMNametoMID[metricsSorted[i]]+'_'+station+'">1.01</td>');
                }
                //Append aggregate cell here
                row.append('<td id="a_'+station+'">1.01</td>');

                $("#grid tbody").append(row);
            }
        }

    }
    else if(pageType == "station"){
        gridhead.append('<th id="location">Location</th>');
        gridhead.append('<th id="channel">Channel</th>');
        for( var i = 0; i<metricsSorted.length; i++){
            gridhead.append('<th id="'+mapMNametoMID[metricsSorted[i]]+'">'+metricsSorted[i]+'</th>');
        }
        gridhead.append('<th id="aggregate">Aggregate</th>');

        for(channel in mapCIDtoCName){
            if(mapCIDtoCName.hasOwnProperty(channel)){
                var row = $(
                    '<tr id = "'+channel+'"><td>'+mapCIDtoLoc[channel]+'</td>'
                    +'<td>'+mapCIDtoCName[channel]+'</a></td></tr>'
                );
                //Adding 1.01 causes datatables to automatically set the column types to numeric
                for( var i = 0; i<metricsSorted.length; i++){
                    row.append('<td id="d_'+mapMNametoMID[metricsSorted[i]]+'_'+channel+'">1.01</td>');
                }
                //Add Aggregate column
                row.append('<td id="a_'+channel+'">1.01</td>');

                $("#grid tbody").append(row);
            }
        }
    }
}

//Basic initialization and setup for datatable
function initializeTable(){

    dTable = $('#grid').dataTable( {
        "bJQueryUI":true
        ,"bPaginate":false
        //        ,"sScrollY":"300px"
        ,"sScrollY": (window.innerHeight - 220)+"px"
        // ,"sScrollYInner": "110%"
        ,"sScrollX": "100%"
        //,"sScrollXInner": "5200px"
        ,"bScrollCollapse": true
        //,"sDom": 'TC<"clear">lfrtip'
    });
    if (pageType == "summary"){
        dTable.fnSetColumnVis(2, false);
    }
    dTable.fnSort([[0,'asc'],[1,'asc']]);
}

function formatTableTools(button, icon){
    $(button).removeClass('DTTT_button');
    $(button).button({icons: {primary: icon}});
    $('.DTTT_container').buttonset();
}

//fillTable() queries the CGI for data, parses it with parseDataReturn(), then calls processAllAggr().
//It uses global variable numCols to track how many columns have been updated.
function fillTable(){
    resetPercents();
    dTableAjaxMan.abort();
    /*$.manageAjax.destroy('dTableAjaxMan');
    dTableAjaxMan = $.manageAjax.create('dTableAjaxMan',
    {
    queue: false,
    cacheResponse: false
    }
    );*/
    var rowIDs = new String(); //Will contain a list of delimited channel/station IDs EG 20-21-22-35
    rowIDs = "";
    var dates = getQueryDates();
    var visibleRows = $('tbody tr', dTable.fnSettings().nTable);
    $.each(visibleRows, function(c){
        rowIDs= rowIDs+"-"+$(visibleRows[c]).closest('tr').attr('id');
    });
    rowIDs = rowIDs.substr(1); //trims initial "-" from the string
    if (pageType == "summary"){
        $.each(dTable.fnSettings().aoColumns, function(c){
            if(dTable.fnSettings().aoColumns[c].bVisible == true){
                if(mapMNametoMID[dTable.fnSettings().aoColumns[c].sTitle]){
                    var metricID = mapMNametoMID[dTable.fnSettings().aoColumns[c].sTitle];
                    dTableAjaxMan.add({
                        success: function(data){
                            parseDataReturn(data, metricID);
                            if(dTableAjaxMan.inProgress <= 1){
                                processAllAggr();//compute aggregate This is called twice during the first load
                                dTable.fnDraw();
                            }
                        },
                        url: "cgi-bin/metrics.py",
                        data: {cmd: "stationgrid", param: "station."+rowIDs+
                            "_metric."+metricID+"_dates."+dates}
                    });
                }
            }
        });
    }
    else if (pageType == "station"){
        $.each(dTable.fnSettings().aoColumns, function(c){
            if(dTable.fnSettings().aoColumns[c].bVisible == true){
                if(mapMNametoMID[dTable.fnSettings().aoColumns[c].sTitle]){
                    var metricID = mapMNametoMID[dTable.fnSettings().aoColumns[c].sTitle];
                    dTableAjaxMan.add({
                        success: function(data){
                            parseDataReturn(data, metricID);
                            if(dTableAjaxMan.inProgress <= 1){
                                processAllAggr();//compute aggregate This is called twice during the first load
                                dTable.fnDraw();
                            }
                        },
                        url: "cgi-bin/metrics.py",
                        data: {cmd: "channelgrid", param: "channel."+rowIDs+
                            "_metric."+metricID+"_dates."+dates}
                    });
                }
            }
        });
    }
}

function parseDataReturn(data,mid){
    var rows = new Array();
    rows = data.split("\n");
    for(var i = 0; i <rows.length; i++){
        row = rows[i].split(","); //stationID/channelID, value, percentage
        if(row[0] && row[1] && mid){ //Check if id, value, and metricID exist
            addPercent(row[0], mid, row[2]);
            var cell = document.getElementById("d_"+mid+"_"+row[0]);
            if(cell){
                var pos = dTable.fnGetPosition(cell);
                $("#d_"+mid+"_"+row[0]).addClass("ltd");
                //Double parseFloat() drops excess 0's
                dTable.fnUpdate(parseFloat(parseFloat(row[1]).toFixed(2)), pos[0], pos[2], false, false );
            }
        }
    }
}

//Called in by btnRefresh created in header.js.  Calling refresh will clear and repull data on a built table.
function refreshTable(){
    clearTable();
    fillTable();
}


