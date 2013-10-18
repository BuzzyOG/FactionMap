$(document).ready( function(){ loadMapData(); } )

var baseCanvas;
var baseCtx;
var selCanvas;
var selCtx;
var mapData;
var factionData;

function loadMapData()
{
	baseCanvas = document.getElementById("baselayer");
	baseCtx = baseCanvas.getContext("2d");
	selCanvas = document.getElementById("selectionlayer");
	selCtx = selCanvas.getContext("2d");
	baseCanvas.width = selCanvas.width = $("#drawstack").width();
	baseCanvas.height = selCanvas.height = $("#drawstack").height();
	$("#maplink").click(showMap);
	$("#pointslink").click(showPoints);
	$.getJSON("map.json", function(data) {
		mapData = data;
		preprocessMapData();
		loadFactionData();
	});
}

function loadFactionData()
{
	$.getJSON("factions.json", function(data) {
		factionData = data;
		preprocessFactionData();
		drawBaseMap();
		$("#drawstack").mousemove(onMouseOverMap);
	});
}

function showInfoBox(visible, x, y, provinceId)
{
	if (visible) {
		$("#infobox").css({display: "block", left: x + 5, top: y + 5 });
		var msg = "Province Id: " + provinceId + "<br />";
		var province = mapData.provinces[provinceId];
		if (province.faction != -1) {
			msg += "Name: " + province.name + "<br />";
			msg += "Faction: " + province.factionname + "<br />";
			if (province.heartland)
				msg += "Heartland!<br />";
			if (province.region != -1)
				msg += "Region: " + province.regionname + "<br />";
		}
		$("#infobox").html(msg);
	} else
		$("#infobox").css({display: "none"});
}

function highlightProvince(provinceId)
{
	selCtx.clearRect(0, 0, selCanvas.width, selCanvas.height);
	if (provinceId != -1) {
		var province = mapData.provinces[provinceId];
		selCtx.strokeStyle = "orange";
		selCtx.lineWidth = 3;
		var x = province.points[0].x * selCanvas.width;
		var y = province.points[0].y * selCanvas.height;
		selCtx.beginPath();
		selCtx.moveTo(x, y);
		for (var i = 1; i < province.points.length; i++) {
			x = province.points[i].x * selCanvas.width;
			y = province.points[i].y * selCanvas.height;
			selCtx.lineTo(x, y);
		}
		selCtx.closePath();
		selCtx.stroke();
	}
}

function onMouseOverMap(event)
{
	var ofs = $("#drawstack").offset();
	var rx = event.pageX - ofs.left;
	var ry = event.pageY - ofs.top;
	rx /= baseCanvas.width;
	ry /= baseCanvas.height;
	var point = {x: rx, y: ry};
	var found = -1;
	for (var i = 0; i < mapData.provinces.length; i++) {
		if (pointInProvince(point, mapData.provinces[i])) {
			found = mapData.provinces[i].id;
			break;
		}
	}
	showInfoBox((found != -1), event.pageX, event.pageY, found);
	highlightProvince(found);
}

function drawBaseMap()
{
	drawProvinces();
	drawRegionBorders();
}

function drawProvinces()
{
	baseCtx.lineWidth = 0.5;
	baseCtx.strokeStyle = "black";
	$.each(mapData.provinces, function(k, province) {
		var x = province.points[0].x * baseCanvas.width;
		var y = province.points[0].y * baseCanvas.height;
		baseCtx.beginPath();
		baseCtx.moveTo(x, y);
		for (var i = 1; i < province.points.length; i++) {
			x = province.points[i].x * baseCanvas.width;
			y = province.points[i].y * baseCanvas.height;
			baseCtx.lineTo(x, y);
		}
		baseCtx.closePath();
		if (province.faction != -1) {
			var opacity = "0.4";
			if (province.heartland) opacity = "0.5";
			baseCtx.fillStyle = "rgba(" + factionData.factions[province.faction].color + ", " + opacity + ")";
			baseCtx.fill();
		}
		baseCtx.stroke();
	});
}

function drawRegionBorders()
{
	baseCtx.lineWidth = 2;
	baseCtx.strokeStyle = "black";
	for (var r = 0; r < mapData.regions.length; r++) {
		var region = mapData.regions[r];
		for (var e = 0; e < mapData.regions[r].edges.length; e++) {
			var edge = mapData.regions[r].edges[e];
			var x = edge.points[0].x * baseCanvas.width;
			var y = edge.points[0].y * baseCanvas.height;
			baseCtx.beginPath();
			baseCtx.moveTo(x, y);
			for (var p=1; p<edge.points.length; p++) {
				x = edge.points[p].x * baseCanvas.width;
				y = edge.points[p].y * baseCanvas.height;
				baseCtx.lineTo(x, y);
			}
			baseCtx.stroke();
		}
	}
}

function pointInProvince(pt, province)
{
	var c = false;
	if (pt.x >= province.xmin && pt.x <= province.xmax && pt.y >= province.ymin && pt.y <= province.ymax) {
		var poly = province.points;
		for (var i = -1, l = poly.length, j = l - 1; ++i < l; j = i)
			((poly[i].y <= pt.y && pt.y < poly[j].y) || (poly[j].y <= pt.y && pt.y < poly[i].y))
				&& (pt.x < (poly[j].x - poly[i].x) * (pt.y - poly[i].y) / (poly[j].y - poly[i].y) + poly[i].x)
				&& (c = !c);
	}
	return c;
}

function preprocessMapData()
{
	for (var i = 0; i < mapData.provinces.length; i++) {
		
		// Set faction and regions of provinces to neutral
		mapData.provinces[i].faction = -1;
		mapData.provinces[i].factionname = "";
		mapData.provinces[i].region = -1;
		mapData.provinces[i].regionname = "";
		
		// Merge edges to one large polygon
		buildPoints(mapData.provinces[i]);
		
		// Find bounding box of provinces
		findBoundingBox(mapData.provinces[i]);
	}
}

function preprocessFactionData()
{
	// Mark provinces in mapData with name + faction info and extract regions
	mapData.regions = [];
	for (var f = 0; f < factionData.factions.length; f++) {
		for (var p = 0; p < factionData.factions[f].provinces.length; p++) {
			var pid = factionData.factions[f].provinces[p].id;
			mapData.provinces[pid].name = factionData.factions[f].provinces[p].name;
			mapData.provinces[pid].faction = f;
			mapData.provinces[pid].factionname = factionData.factions[f].name;
		}
		for (var r = 0; r < factionData.factions[f].regions.length; r++) {
			factionData.factions[f].regions[r].faction = f;
			mapData.regions.push(factionData.factions[f].regions[r]);
			for (var p = 0; p < factionData.factions[f].regions[r].provinces.length; p++) {
				var pid = factionData.factions[f].regions[r].provinces[p];
				mapData.provinces[pid].region = mapData.regions.length - 1;
				mapData.provinces[pid].regionname = factionData.factions[f].regions[r].name;
			}
		}
	}
	
	// Check provinces for heartland
	for (var i = 0; i < mapData.provinces.length; i++) {
		mapData.provinces[i].heartland = false;
		if (mapData.provinces[i].faction != -1) {
			mapData.provinces[i].heartland = true;
			for (var j = 0; j < mapData.provinces[i].edges.length; j++) {
				var neighborId = mapData.provinces[i].edges[j].neighbor;
				if (mapData.provinces[neighborId].faction == -1 ||
					mapData.provinces[neighborId].faction != mapData.provinces[i].faction) {
					mapData.provinces[i].heartland = false;
					break;
				}
			}
		}
	}
	
	// Find borders of all regions for drawing
	for (var r = 0; r < mapData.regions.length; r++) {
		mapData.regions[r].edges = [];
		for (var p = 0; p < mapData.regions[r].provinces.length; p++) {
			var pid = mapData.regions[r].provinces[p];
			var edges = mapData.provinces[pid].edges;
			for (var e = 0; e < edges.length; e++) {
				if (!isInList(edges[e].neighbor, mapData.regions[r].provinces)) {
					mapData.regions[r].edges.push(edges[e]);
				}
			}
		}
	}
}

function isInList(item, list)
{
	for (var i=0; i<list.length; i++) {
		if (item == list[i]) return true;
	}
	return false;
}

function buildPoints(p)
{
	p.points = [];
	for (var i=0; i<p.edges.length; i++) {
		p.edges[i].points = [];
		for (var j=0; j<p.edges[i].xpoints.length && j<p.edges[i].ypoints.length; j++) {
			var point = {x: p.edges[i].xpoints[j], y: p.edges[i].ypoints[j]};
			p.points.push(point);
			p.edges[i].points.push(point);
		}
	}
}

function findBoundingBox(p)
{
	p.xmin = p.points[0].x;
	p.ymin = p.points[0].y;
	p.xmax = p.points[0].x;
	p.ymax = p.points[0].y;
	for (var i = 0; i < p.points.length; i++) {
		if (p.points[i].x < p.xmin) p.xmin = p.points[i].x;
		if (p.points[i].y < p.ymin) p.ymin = p.points[i].y;
		if (p.points[i].x > p.xmax) p.xmax = p.points[i].x;
		if (p.points[i].y > p.ymax) p.ymax = p.points[i].y;
	}
}

function findCenter(p)
{
	p.center = {x: 0, y: 0};
}

function showMap()
{
	$("#drawstack").css({display: "block"});
	$("#points").css({display: "none"});
}

function showPoints()
{
	$("#drawstack").css({display: "none"});
	$("#points").css({display: "block"});
}