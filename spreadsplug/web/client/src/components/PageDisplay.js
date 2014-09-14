/** @jsx React.DOM */
/* global module, require */

(function () {
  'use strict';

  var React = require('react/addons'),
      jQuery = require('jquery'),
      _ = require('underscore'),
      Overlay = require('./overlays.js').Overlay,
      Activity = require('./overlays.js').Activity,
      F = require('./foundation.js'),
      util = require('../util.js');

  var PageDisplay = React.createClass({

    displayName: "PageDisplay",

    getInitialState: function () {
      var result = {
	// True if waiting for page update
	isWaiting: false,
	// True if waiting to load image
	isLoadingImage: true,
	// Our two example postprocessing hints
	color: '',
	section: ''
      };
      return result;
    },

    handleResize: function (e) {
      this.showImage();
    },

    componentWillMount: function () {
      this.imageCache = {};
      this.setState({ isLoadingImage: true });
    },

    componentDidMount: function () {
      var light = this.getCurrent();
      var data = {
	color: '',
	section: ''
      };
      if (light.page && light.page.postprocessing_hints)
      {
	data.color = light.page.postprocessing_hints.color;
	data.section = light.page.postprocessing_hints.section;
      }
      this.setState(data);
      window.addEventListener("resize", this.handleResize);
    },

    componentWillUnmount: function () {
      this.imageCache = {};
      window.removeEventListener("resize", this.handleResize);
    },

    // Uses pageNum (sequence number) to find current page, page list,
    // page index, and page url
    getCurrent: function () {
      var result = {};
      result.list = this.props.workflow.get('pages');
      result.page = _.findWhere(result.list,
				{ sequence_num: this.props.pageNum });
      result.index = result.list.indexOf(result.page);
      if (result.page)
      {
	result.url = util.getPageUrl(this.props.workflow,
				     result.page.capture_num,
                                     this.props.imageType,
				     false);
      }
      return result;
    },

    // Handle the user clicking next.
    handleNext: function (e) {
      e.stopPropagation();
      this.commit(function () {
	var light = this.getCurrent();
	var nextPage;
	if (light.index !== -1 && light.index < light.list.length - 1)
	{
	  nextPage = light.list[light.index + 1];
	}
	this.props.onChange(nextPage.sequence_num);
	// Make the previous setting sticky so that they automatically
	// carry over unless changed.
	var data = {
	  color: '',
	  section: ''
	};
	_.each(data, function (value, key) {
	  if (nextPage.postprocessing_hints)
	  {
	    data[key] = nextPage.postprocessing_hints[key];
	  }
	  if (light.page.postprocessing_hints &&
	      light.page.postprocessing_hints[key] &&
	      (! data[key] || data[key] === ''))
	  {
	    data[key] = light.page.postprocessing_hints[key];
	  }
	});
	this.setState(data);
      }.bind(this));
    },

    // Handle the user clicking previous. No stickiness here.
    handlePrevious: function (e) {
      e.stopPropagation();
      this.commit(function () {
	var light = this.getCurrent();
	var previousPage;
	if (light.index !== -1 && light.index > 0)
	{
	  previousPage = light.list[light.index - 1];
	}
	this.props.onChange(previousPage.sequence_num);
	var data = {
	  color: '',
	  section: ''
	};
	_.each(data, function (value, key) {
	  if (previousPage.postprocessing_hints)
	  {
	    data[key] = previousPage.postprocessing_hints[key];
	  }
	});
	this.setState(data);
      }.bind(this));
    },

    // The user clicks done. Commit changes and return to main list.
    handleDone: function (e) {
      e.stopPropagation();
      this.commit(function () {
	this.props.onChange(undefined);
      }.bind(this));
    },

    // The user has typed in an input box or changed a select item.
    handleChangeField: function (field, e) {
      e.stopPropagation();
      var data = {};
      data[field] = e.target.value;
      this.setState(data);
    },

    // Save changes to server. Pop up an overlay while we wait and run
    // callback when complete. Only update server if something changed.
    commit: function (callback) {
      var options = {
	onSuccess: function () {
	  this.setState({ isWaiting: false });
	  callback();
	}.bind(this),
	onFailure: function () {
	  this.setState({ isWaiting: false });
	  // TODO: Do something smarter on failure
	  alert('Failed to save this page metadata.');
	  callback();
	}.bind(this)
      };
      var data = {
	color: this.state.color,
	section: this.state.section
      };
      var light = this.getCurrent();
      var hasChanged = false;
      if (light.page)
      {
	_.each(data, function (value, key) {
	  if (light.page.postprocessing_hints[key] !== value)
	  {
	    hasChanged = true;
	  }
	}.bind(this));
      }
      if (hasChanged)
      {
	this.setState({ isWaiting: true });
	this.props.workflow.setPagePostProperties(light.page.capture_num,
						  data, options);
      }
      else
      {
	callback();
      }
    },

    // Reset the image cache. Start loading the current image URL, the
    // next image URL, and the previous image URL. If any of these
    // were part of the previous image cache, retain them.
    resetCache: function ()
    {
      var oldCacheCount = _.keys(this.imageCache).length;
      var newCache = {};
      var light = this.getCurrent();
      if (light.page)
      {
	var oldShowUrl, newShowUrl;
	var shownCaptureNum = light.page.capture_num;
	var list = [light.page.capture_num];
	if (light.index !== -1 && light.index > 0 && oldCacheCount > 0)
	{
	  list.push(light.list[light.index - 1].capture_num);
	}
	if (light.index !== -1 && light.index < light.list.length - 1 &&
	    oldCacheCount > 0)
	{
	  list.push(light.list[light.index + 1].capture_num);
	}
	_.each(list, function (captureNum) {
	  var shouldShow = (captureNum === shownCaptureNum);
	  var url = util.getPageUrl(this.props.workflow,
				    captureNum,
                                    this.props.imageType,
				    false);
	  if (shouldShow)
	  {
	    newShowUrl = url;
	  }
	  if (this.imageCache[url])
	  {
	    if (this.imageCache[url].shouldShow)
	    {
	      oldShowUrl = url;
	    }
	    newCache[url] = this.imageCache[url];
	    newCache[url].shouldShow = shouldShow;
	  }
	  else
	  {
	    newCache[url] = this.makeNewImage(url, shouldShow);
	  }
	}.bind(this));
	if (oldShowUrl !== newShowUrl)
	{
	  this.showImage();
	}
      }
      this.imageCache = newCache;
    },

    // Make a new image structure for the image cache. This contains
    // the actual Image along with metadata, generated thumbnail, etc.
    makeNewImage: function (url, shouldShow)
    {
      var result = {
	url: url,
	shouldShow: shouldShow,
	jpeg: new Image(),
	isLoaded: false
      };
      result.jpeg.onload = function () {
	var current = this.imageCache[url];
	if (current)
	{
	  current.isLoaded = true;
	  current.thumbnail = document.createElement('canvas');
	  var scale = this.calculateScale(current.jpeg, 800, 800);
	  current.thumbnail.width = current.jpeg.width * scale;
	  current.thumbnail.height = current.jpeg.height * scale;

	  var context = current.thumbnail.getContext('2d');
	  context.drawImage(current.jpeg, 0, 0,
			    current.thumbnail.width,
			    current.thumbnail.height);

	  if (current.shouldShow)
	  {
	    this.showImage();
	    this.setState({ isLoadingImage: false });
	  }
	  this.resetCache();
	}
      }.bind(this);
      result.jpeg.src = url;
      return result;
    },

    // Show the current image on the canvas.
    showImage: function ()
    {
      if (this.isMounted())
      {
	_.each(this.imageCache, function (image) {
	  if (image.isLoaded && image.shouldShow)
	  {
	    var maxWidth = this.refs.canvasColumn.getDOMNode().clientWidth - 30;
	    var maxHeight = window.innerHeight - 50;
	    this.refs.pageColumn.getDOMNode().setAttribute('style', 'height: ' + maxHeight + 'px');
	    var scale = this.calculateRotatedScale(image.thumbnail,
						   maxWidth, maxHeight);
	    var rotation = this.calculateRotation();
	    var width = image.thumbnail.height * scale;
	    var height = image.thumbnail.width * scale;

	    var canvas = this.refs.canvas.getDOMNode();
	    canvas.width = maxWidth;
	    canvas.height = maxHeight;

	    var context = canvas.getContext("2d");
	    context.rotate(rotation.angle * Math.PI / 180);
	    context.drawImage(image.thumbnail,
			      height * rotation.offsetX + (maxHeight - height)/2 * rotation.extraX,
			      width * rotation.offsetY + (maxWidth - width)/2 * rotation.extraY,
			      height, width);
	  }
	}.bind(this));
      }
    },

    // Find the proper scale assuming we will rotate the jpeg
    calculateRotatedScale: function (jpeg, windowWidth, windowHeight)
    {
      var scaleX = windowWidth / jpeg.height;
      var scaleY = windowHeight / jpeg.width;
      return Math.min(scaleX, scaleY);
    },

    // Find the proper scale when we are just scaling with no rotation
    // (for thumbnail).
    calculateScale: function (jpeg, windowWidth, windowHeight)
    {
      var scaleX = windowWidth / jpeg.width;
      var scaleY = windowHeight / jpeg.height;
      return Math.min(scaleX, scaleY);
    },

    // Find the rotation. This is based on whether the page is
    // odd/even and whether the cameras are upside down. When rotating
    // in the canvas, we need to translate as well as rotate to show
    // things properly.
    calculateRotation: function ()
    {
      // TODO: What do we do when camera setting has been changed
      // halfway through a workflow?
      var result = {
	angle: 90,
	offsetX: 0,
	offsetY: -1,
	extraX: 1,
	extraY: -1
      };
      var light = this.getCurrent();
      if (light.page && light.page.is_odd
	  && this.props.workflow.get('config').device.upside_down)
      {
	result = {
	  angle: 270,
	  offsetX: -1,
	  offsetY: 0,
	  extraX: -1,
	  extraY: 1
	};
      }
      return result;
    },

    // Get the current form state for render. Make sure that we use
    // empty strings instead of null/undefined.
    getPageData: function () {
      var result = {};
      var light = this.getCurrent();
      if (light.page && light.page.postprocessing_hints)
      {
	result = {
	  color: this.state.color,
	  section: this.state.section
	};
      }
      if (! result.color)
      {
	result.color = '';
      }
      if (! result.section)
      {
	result.section = '';
      }
      return result;
    },

    render: function () {
      this.resetCache();
      if (this.state.isWaiting)
      {
	return (<Overlay>
		  <Activity message="Saving metadata" />
		</Overlay>);
      }

      var light = this.getCurrent();
      var rotateClass = 'imageLeft';
      if (light.page && light.page.is_odd
	  && this.props.workflow.get('config').device.upside_down)
      {
	rotateClass = 'imageRight';
      }


      var data = this.getPageData();
      var hasNext = (light.index !== -1 &&
		     light.index < light.list.length - 1);
      var hasPrevious = (light.index !== -1 && light.index > 0);

      return (
	<div className="page-display">
          <div className="page-row">
            <div className="page-column" ref='canvasColumn'>
	      <a data-bypass={true} title="Open full resolution image in new tab" className="open-image" href={light.url} target="_blank">
	        <canvas ref="canvas" />
	      </a>
	    </div>
	    <div className="page-column">
	      <div ref="pageColumn" className="page-form">
	        <fieldset>
	          <legend>Page Metadata</legend>
	          <label>Section
	            <input id="section" type="text" value={data.section}
	                   onChange={_.partial(this.handleChangeField, 'section')}/>
	          </label>
	        </fieldset>
	        <fieldset>
	          <legend>Postprocessing Hints</legend>
	          <label>Color Range
	            <select id="color" value={data.color}
	                    onChange={_.partial(this.handleChangeField, 'color')}>
	              <option value=""></option>
	              <option value="binary">Binary</option>
	              <option value="grayscale">Grayscale</option>
	              <option value="color">Full Color</option>
	            </select>
	          </label>
	        </fieldset>
	  <div>
	    <div className="page-nav">
	      <div><F.Button disabled={!hasPrevious} onClick={this.handlePrevious}><i className="fa fa-caret-left"/></F.Button></div>
	      <div><F.Button onClick={this.handleDone}>Done</F.Button></div>
	      <div><F.Button disabled={!hasNext} onClick={this.handleNext}><i className="fa fa-caret-right"/></F.Button></div>
	    </div>
	  </div>
	      </div>
	    </div>
	  </div>
	  {this.state.isLoadingImage &&
	    <Overlay>
	      <Activity message="Loading Page" />
	    </Overlay>}
        </div>);
    }

  });

  module.exports = {
    PageDisplay: PageDisplay
  };

})();
