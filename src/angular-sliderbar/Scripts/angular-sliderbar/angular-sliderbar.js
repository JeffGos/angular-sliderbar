angular.module('angularSliderBar', [])

.directive('sliderBar', ['$window', '$document', '$compile', '$templateCache', '$timeout', function ($window, $document, $compile, $templateCache, $timeout) {

	self.draggableTopTemplate = null;
	self.draggableBottomTemplate = null;
	self.rangedDraggableTemplate = null;
	self.valueRangeTemplate = null;

	self.sliderContainerElement = null;
	self.markersContainerElement = null;
	self.draggableContainerElements = [];

	self.activeDraggableName = null;

	self.draggables = [];
	self.pendingDraggablesRedrawFuture = null;

	self.rangedDraggables = [];
	self.pendingRangedDraggablesRedrawFuture = null;

	self.valueRanges = [];
	self.pendingValueRangesRedrawFuture = null;

	self.markers = [];
	self.pendingMarkersRedrawFuture = null;

	function link(scope, element, attrs) {
		var self = this;

		self.draggableTopTemplate = $templateCache.get('angular-sliderbar-draggable-top.html');
		self.draggableBottomTemplate = $templateCache.get('angular-sliderbar-draggable-bottom.html');
		self.rangedDraggableTemplate = $templateCache.get('angular-sliderbar-draggable-range.html');
		self.valueRangeTemplate = $templateCache.get('angular-sliderbar-value-range.html');

		self.sliderContainerElement = angular.element(element[0].children[0].children[1]);
		self.markersContainerElement = angular.element(element[0].children[0].children[2]);

		self.draggableContainerElements['TOP'] = angular.element(element[0].children[0].children[0]);
		self.draggableContainerElements['BOTTOM'] = angular.element(element[0].children[0].children[3]);

		if (!self.draggableContainerElements['TOP']) {
			throw "draggableContainerElements['TOP'] not defined";
		}

		if (!self.draggableContainerElements['BOTTOM']) {
			throw "draggableContainerElements['BOTTOM'] not defined";
		}

		if (!self.sliderContainerElement) {
			throw "sliderContainerElement not defined";
		}

		if (!self.markersContainerElement) {
			throw "markersContainerElement not defined";
		}

		self.clear = function () {
			self.clearDraggables();
			self.clearRangedDraggables();
			self.clearMarkers();
			self.clearValueRanges();
		}

		self.addDraggable = function (properties) {

			var name = properties.name || "" + getAssociativeArrayLength(self.draggables);

			if (self.draggables[name]) {
				return self.draggables[name];
			}

			if (self.pendingDraggablesRedrawFuture) {
				$timeout.cancel(self.pendingDraggablesRedrawFuture);
			}

			if (!self.activeDraggableName) {
				self.activeDraggableName = name;
			}

			var draggable = new Draggable();

			draggable.name = name;
			draggable.align = (typeof properties.align === "undefined") ? draggable.align : properties.align;
			draggable.minValuePercent = (typeof properties.minValuePercent === "undefined") ? draggable.minValuePercent : properties.minValuePercent;
			draggable.maxValuePercent = (typeof properties.maxValuePercent === "undefined") ? draggable.maxValuePercent : properties.maxValuePercent;
			draggable.currentValuePercent = (typeof properties.startPosition === "undefined") ? 0 : properties.startPosition;
			draggable.label = (typeof properties.label === "undefined") ? draggable.label : properties.label;
			draggable.$document = $document;

			if (properties.top == true || (typeof properties.top === "undefined")) {
				draggable.rootElement = angular.element(self.draggableTopTemplate);
				draggable.labelElement = angular.element(draggable.rootElement[0].children[0]);
				draggable.containerElement = self.draggableContainerElements['TOP'];
			} else {
				draggable.rootElement = angular.element(self.draggableBottomTemplate);
				draggable.labelElement = angular.element(draggable.rootElement[0].children[2]);
				draggable.containerElement = self.draggableContainerElements['BOTTOM'];
			}

			draggable.rootElement.on('mousedown', draggable.onMouseDown);

			if (properties.onPositionChangedCallback) {
				draggable.onPositionChanged = properties.onPositionChangedCallback;
			}

			if (properties.onPositionChangingCallback) {
				draggable.onPositionChanging = properties.onPositionChangingCallback;
			}

			if (properties.onPositionSetCallback) {
				draggable.onPositionSet = properties.onPositionSetCallback;
			}

			self.draggables[draggable.name] = draggable;

			draggable.containerElement.append(draggable.rootElement);

			self.pendingDraggablesRedrawFuture = $timeout(function () { self.redrawDraggables(); }, 10);

			return draggable;
		}

		self.removeDraggable = function (name) {
			if (self.draggables[name]) {

				self.draggables[name].rootElement.remove();
				self.draggables[name] = null;
				delete self.draggables[name];
			}
		}

		self.clearDraggables = function () {
			for (var key in self.draggables) {
				if (self.draggables.hasOwnProperty(key)) {

					if (self.draggables[key]) {
						self.draggables[key].rootElement.remove();
						self.draggables[key] = null;
						delete self.draggables[key];
					}
				}
			}

			self.draggables = [];
		}

		self.addRangedDraggable = function (properties) {

			var name = properties.name || "" + getAssociativeArrayLength(self.rangedDraggables);

			if (self.rangedDraggables[name]) {
				return self.rangedDraggables[name];
			}

			if (self.pendingRangedDraggablesRedrawFuture) {
				$timeout.cancel(self.pendingRangedDraggablesRedrawFuture);
			}

			var rangedDraggable = new RangedDraggable();

			rangedDraggable.name = name;
			rangedDraggable.rootElement = angular.element(self.rangedDraggableTemplate);
			rangedDraggable.rangeElement = angular.element(rangedDraggable.rootElement[0]);

			if (properties.top == true) {
				rangedDraggable.containerElement = self.draggableContainerElements['TOP'];
			} else {
				rangedDraggable.containerElement = self.draggableContainerElements['BOTTOM'];
			}

			if (properties.onPositionChangedCallback) {
				rangedDraggable.onPositionChanged = properties.onPositionChangedCallback;
			}

			if (properties.onPositionChangingCallback) {
				rangedDraggable.onPositionChanging = properties.onPositionChangingCallback;
			}

			if (properties.startDraggableProperties) {
				properties.startDraggableProperties.top = properties.top;
				properties.startDraggableProperties.align = "left";
				rangedDraggable.startDraggable = self.addDraggable(properties.startDraggableProperties);

				rangedDraggable.startDraggable.onPositionChanged = rangedDraggable.onDraggablePositionChanged;
				rangedDraggable.startDraggable.onPositionChanging = rangedDraggable.onDraggablePositionChanging;
				rangedDraggable.startDraggable.onPositionSet = rangedDraggable.onPositionSet;

				rangedDraggable.startDraggable.rootElement.addClass("sb-ranged-draggable-start");
			}

			if (properties.endDraggableProperties) {
				properties.endDraggableProperties.top = properties.top;
				properties.endDraggableProperties.align = "right";
				rangedDraggable.endDraggable = self.addDraggable(properties.endDraggableProperties);

				rangedDraggable.endDraggable.onPositionChanged = rangedDraggable.onDraggablePositionChanged;
				rangedDraggable.endDraggable.onPositionChanging = rangedDraggable.onDraggablePositionChanging;
				rangedDraggable.startDraggable.onPositionSet = rangedDraggable.onPositionSet;

				rangedDraggable.endDraggable.rootElement.addClass("sb-ranged-draggable-end");
			}

			self.rangedDraggables[rangedDraggable.name] = rangedDraggable;
			rangedDraggable.containerElement.append(rangedDraggable.rootElement);

			self.pendingDraggablesRedrawFuture = $timeout(function () { self.redrawDraggables(); }, 10);

			return rangedDraggable;
		}

		self.removeRangedDraggable = function (name) {
			if (self.rangedDraggables[name]) {

				if (self.rangedDraggables[name].startDraggable) {
					removeDraggable(self.rangedDraggables[name].startDraggable.name);
				}

				if (self.rangedDraggables[name].endDraggable) {
					removeDraggable(self.rangedDraggables[name].endDraggable.name);
				}

				self.rangedDraggables[name].rootElement.remove();
				self.rangedDraggables[name] = null;
				delete self.rangedDraggables[name];
			}
		}

		self.clearRangedDraggables = function () {

			for (var key in self.rangedDraggables) {
				if (self.rangedDraggables.hasOwnProperty(key)) {

					if (self.rangedDraggables[key]) {
						if (self.rangedDraggables[key].startDraggable) {
							removeDraggable(self.rangedDraggables[key].startDraggable.name);
						}

						if (self.rangedDraggables[key].endDraggable) {
							removeDraggable(self.rangedDraggables[key].endDraggable.name);
						}

						self.rangedDraggables[key].rootElement.remove();
						self.rangedDraggables[key] = null;
						delete self.rangedDraggables[key];
					}
				}
			}

			self.rangedDraggables = [];
		}

		self.addMarker = function (properties) {

			if (self.pendingMarkersRedrawFuture) {
				$timeout.cancel(self.pendingMarkersRedrawFuture);
			}

			var marker = new Marker();
			marker.index = markers.length;
			marker.rootElement = $compile("<div ng-click='onMarkerClick($event, \"" + marker.index + "\")'><div></div></div>")(scope);
			marker.containerElement = self.markersContainerElement;
			marker.label = properties.label || "";
			marker.valuePercent = properties.positionPercent;
			marker.width = properties.width || 31;

			self.markers.push(marker);

			var cls = properties.cssClass || "sb-marker";
			var label = properties.label || "";

			marker.rootElement.addClass(cls);
			marker.rootElement.append(label);
			marker.containerElement.append(marker.rootElement);

			self.pendingMarkersRedrawFuture = $timeout(function () { self.redrawMarkers(); }, 10);
		}

		self.removeMarker = function (index) {
			self.markers[index].rootElement.remove();
			self.markers.splice(index, 1);
		}

		self.clearMarkers = function () {
			for (var i = 0; i < self.markers.length; i++) {
				self.markers[i].rootElement.remove();
			}
			self.markers = [];
		}

		self.addValueRange = function (properties) {

			if (self.pendingValueRangesRedrawFuture) {
				$timeout.cancel(self.pendingValueRangesRedrawFuture);
			}

			var valueRange = new ValueRange();

			valueRange.index = valueRange.length;
			valueRange.fromPercent = properties.fromPercent;
			valueRange.toPercent = properties.toPercent;
			valueRange.cssClass = properties.cssClass;
			valueRange.rootElement = angular.element(self.valueRangeTemplate);
			valueRange.rootElement.addClass(valueRange.cssClass);
			valueRange.containerElement = self.sliderContainerElement;

			self.valueRanges.push(valueRange);
			valueRange.containerElement.append(valueRange.rootElement);

			self.pendingValueRangesRedrawFuture = $timeout(function () { self.redrawValueRanges(); }, 10);
		}

		self.removeValueRange = function (index) {
			self.valueRanges[index].rootElement.remove();
			self.valueRanges.splice(index, 1);
		}

		self.clearValueRanges = function () {
			for (var i = 0; i < self.valueRanges.length; i++) {
				self.valueRanges[i].rootElement.remove();
			}

			self.valueRanges = [];
		}

		self.setDraggablePosition = function (name, positionPercent) {

			if (self.draggables[name]) {
				self.draggables[name].setPosition(positionPercent);
			}
		}

		self.setDraggableLabel = function (draggableName, label) {

			if (self.draggables[draggableName]) {
				self.draggables[draggableName].setLabel(label);
			}
		}

		self.redrawDraggables = function () {

			self.pendingDraggablesRedrawFuture = null;

			for (var key in self.draggables) {
				if (self.draggables.hasOwnProperty(key)) {
					if (self.draggables[key] && self.draggables[key].rootElement) {

						self.draggables[key].setPosition(self.draggables[key].currentValuePercent);
					}
				}
			}
		}

		self.redrawRangedDraggables = function () {

			self.pendingRangedDraggablesRedrawFuture = null;

			for (var key in self.rangedDraggables) {
				if (self.rangedDraggables.hasOwnProperty(key)) {
					if (self.rangedDraggables[key] && self.rangedDraggables[key].rootElement) {

						self.rangedDraggables[key].updateRange();
					}
				}
			}
		}

		self.redrawValueRanges = function () {

			self.pendingValueRangesRedrawFuture = null;

			for (var i = 0; i < self.valueRanges.length; i++) {

				if (self.valueRanges[i] && self.valueRanges[i].rootElement) {
					var ele = self.valueRanges[i].rootElement;

					var from = self.valueRanges[i].fromPercent;
					var to = self.valueRanges[i].toPercent;

					ele.css({ width: to - from + "%", left: from + "%" });
				}
			}
		}

		self.redrawMarkers = function () {

			self.pendingMarkersRedrawFuture = null;

			for (var i = 0; i < self.markers.length; i++) {

				if (self.markers[i] && self.markers[i].rootElement) {
					var ele = self.markers[i].rootElement;

					var markerRange = self.markers[i].containerElement[0].offsetWidth;
					var markerWidthPercent = markerRange <= 0 ? 0 : self.markers[i].width * 100 / markerRange;
					var leftPercent = self.markers[i].valuePercent - markerWidthPercent / 2;

					ele.css({ width: self.markers[i].width, left: leftPercent + "%" });
				}
			}
		}

		scope.onValuesBarClick = function (event) {
			var percentage = (event.offsetX / event.currentTarget.offsetWidth) * 100;
			if (percentage > 100) {
				percentage = 100;
			}

			if (self.activeDraggableName && self.draggables[self.activeDraggableName]) {

				self.setDraggablePosition(self.activeDraggableName, percentage);
				self.draggables[self.activeDraggableName].onPositionChanged(self.activeDraggableName, self.draggables[self.activeDraggableName].currentValuePercent);
			}
		}

		scope.onMarkerClick = function (event, markerIndex) {

			if (self.activeDraggableName && self.draggables[self.activeDraggableName] && self.markers[markerIndex]) {

				self.setDraggablePosition(self.activeDraggableName, self.markers[markerIndex].valuePercent);
				self.draggables[self.activeDraggableName].onPositionChanged(self.activeDraggableName, self.draggables[self.activeDraggableName].currentValuePercent);
			}
		}

		scope.functions = {};
		scope.functions.clear = self.clear;
		scope.functions.addDraggable = self.addDraggable;
		scope.functions.removeDraggable = self.removeDraggable;
		scope.functions.clearDraggables = self.clearDraggables;
		scope.functions.addRangedDraggable = self.addRangedDraggable;
		scope.functions.removeRangedDraggable = self.removeRangedDraggable;
		scope.functions.clearRangedDraggables = self.clearRangedDraggables;
		scope.functions.addMarker = self.addMarker;
		scope.functions.removeMarker = self.removeMarker;
		scope.functions.clearMarkers = self.clearMarkers;
		scope.functions.addValueRange = self.addValueRange;
		scope.functions.removeValueRange = self.removeValueRange;
		scope.functions.clearValueRanges = self.clearValueRanges;

		scope.functions.setDraggablePosition = self.setDraggablePosition;
		scope.functions.setDraggableLabel = self.setDraggableLabel;
	}

	return {
		restrict: 'E',
		scope: {
			functions: '='
		},
		templateUrl: '/Scripts/angular-sliderbar/angular-sliderbar.html',
		link: link
	}
}]);

function Draggable() {

	var self = this;

	self.currentValuePercent = -1;
	self.name = null;
	self.label = "";
	self.align = "center"; // "center" or "left" or "right"
	self.minValuePercent = 0;
	self.maxValuePercent = 100;

	self.containerElement = null;
	self.rootElement = null;
	self.labelElement = null;
	self.draggableRange = 0;
	self.dragged = false;
	self.lastMouseX = false;
	self.$document = null;

	self.setPosition = function (positionPercent) {
		if (positionPercent < self.minValuePercent) {
			positionPercent = self.minValuePercent;
		}

		if (positionPercent > self.maxValuePercent) {
			positionPercent = self.maxValuePercent;
		}

		self.currentValuePercent = positionPercent;

		self.onPositionSet(self.name, positionPercent);

		var cssPositionPercent = positionPercent;

		var draggableRange = self.containerElement[0].offsetWidth;

		if (draggableRange > 0 && self.align != "right") {
			var widthPercent = self.rootElement[0].offsetWidth * 100 / draggableRange;

			if (self.align == "center") {
				cssPositionPercent -= widthPercent / 2;
			}
			else if (self.align == "left") {
				cssPositionPercent -= widthPercent;
			}
		}

		self.rootElement.css({ left: cssPositionPercent + "%" });
	}

	self.setLabel = function (label) {
		self.labelElement.text(label);
	}

	self.onMouseDown = function () {
		event.preventDefault();
		self.dragged = true;
		self.lastMouseX = event.pageX;

		self.$document.on('mousemove', self.onMouseMove);
		self.$document.on('mouseup', self.onMouseUp);
	}

	self.onMouseUp = function () {
		self.dragged = false;

		self.onPositionChanged(self.name, self.currentValuePercent);

		self.$document.off('mouseup', self.onMouseUp);
		self.$document.off('mousemove', self.onMouseMove);
	}

	self.onMouseMove = function () {
		if (self.dragged) {
			var offset = event.pageX - self.lastMouseX;
			var draggableRange = self.containerElement[0].offsetWidth;

			var offsetPercent = draggableRange > 0 ? offset * 100 / draggableRange : 0;
			var newDragglePositionPercent = self.currentValuePercent + offsetPercent;
			self.lastMouseX = event.pageX;

			self.setPosition(newDragglePositionPercent);
			self.onPositionChanging(self.name, self.currentValuePercent);
		}
	}

	self.onPositionSet = function (name, value) { }
	self.onPositionChanged = function (name, value) { }
	self.onPositionChanging = function (name, value) { }
};

function RangedDraggable() {

	var self = this;

	self.name = "";
	self.startDraggable = null;
	self.endDraggable = null;
	self.containerElement = null;
	self.rootElement = null;
	self.rangeElement = null;

	self.onDraggablePositionChanged = function (name, value) {
		self.updateRange();
		self.onPositionChanged(name, value);
	}

	self.onDraggablePositionChanging = function (name, value) {
		self.updateRange();
		self.onPositionChanging(name, value);
	}

	self.updateRange = function () {

		var startPercent = (self.startDraggable) ? self.startDraggable.currentValuePercent : 0;
		var endPercent = (self.endDraggable) ? self.endDraggable.currentValuePercent : 100;

		if (startPercent < 0) {
			startPercent = 0;
		}

		if (endPercent < 0) {
			endPercent = 0;
		}

		var rangeWidthPercentage = endPercent - startPercent;
		self.rangeElement.css({ left: startPercent + "%", width: rangeWidthPercentage + "%" });

		self.startDraggable.maxValuePercent = self.endDraggable.currentValuePercent;
		self.startDraggable.onPositionSet = self.onPositionSet;
		self.endDraggable.minValuePercent = self.startDraggable.currentValuePercent;
		self.endDraggable.onPositionSet = self.onPositionSet;
	}

	self.onPositionSet = function (name, value) { self.updateRange(); }
	self.onPositionChanged = function (name, value) { }
	self.onPositionChanging = function (name, value) { }
};

function Marker() {
	var self = this;

	self.index = -1;
	self.width = -1;
	self.valuePercent = 0;
	self.label = "";
	self.rootElement = null;
	self.containerElement = null;

	self.setLabel = function () {

	}
}

function ValueRange() {
	var self = this;

	self.index = -1;
	self.fromPercent = -1;
	self.toPercent = -1;
	self.cssClass = null;
	self.rootElement = null;
	self.containerElement = null;
}

function getAssociativeArrayLength(assocArray) {

	if (assocArray == null) {
		return 0;
	}
	var size = 0;
	var key;
	for (key in assocArray) {
		if (assocArray.hasOwnProperty(key)) {
			size++;
		}
	}

	return size;
}