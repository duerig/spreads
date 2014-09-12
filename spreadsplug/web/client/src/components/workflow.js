/** @jsx React.DOM */
/* global module, require */

/*
 * Copyright (C) 2014 Johannes Baiter <johannes.baiter@gmail.com>
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.

 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

(function() {
  'use strict';

  var React = require('react/addons'),
      jQuery = require('jquery'),
      _ = require('underscore'),
      ModelMixin = require('../../vendor/backbonemixin.js'),
      F = require('./foundation.js'),
      Lightbox = require('./overlays.js').LightBox,
      Overlay = require('./overlays.js').Overlay,
      LayeredComponentMixin = require('./overlays.js').LayeredComponentMixin,
      util = require('../util.js');

  var PagePreview = React.createClass({
    propTypes: {
      imageType: React.PropTypes.string
    },

    getInitialState: function() {
      // We always display the toolbar when we're on a touch device, since
      // hover events are not available.
      return { displayToolbar: util.isTouchDevice() };
    },

    showToolbar: function() {
      if (!util.isTouchDevice()) {
        this.setState({displayToolbar: true });
      }
    },

    hideToolbar: function() {
      if (!util.isTouchDevice()) {
	this.setState({ displayToolbar: false });
      }
    },

    render: function() {
      var cx = require('react/addons').addons.classSet,
          liClasses = cx({
            'th': true,
            'page-preview': true,
            'selected': this.props.selected
          }),
          page = this.props.page,
          thumbUrl = util.getPageUrl(this.props.workflow,
                                     page.capture_num,
                                     this.props.imageType, true);
      return (
        <li className={liClasses} title="Open full resolution image in lightbox"
            onMouseEnter={this.showToolbar} onMouseLeave={this.hideToolbar}>
          <F.Row>
            <F.Column>
              <a onClick={this.props.selectCallback}
                 title={this.props.selected ? "Deselect image" : "Select image"}>
                <img src={thumbUrl} />
              </a>
              {this.state.displayToolbar &&
              <a onClick={this.props.lightboxCallback}
                 className="toggle-zoom fa fa-search-plus" />}
            </F.Column>
          </F.Row>
          <F.Row>
            <F.Column>
              {page.page_label}
            </F.Column>
          </F.Row>
        </li>);
    }
  })

  /**
   * Component that displays details for a single workflow along with
   * a paginated grid of thumbnail images and a list of generated output
   * files.
   *
   * @property {Workflow} workflow - Workflow to display
   */
  var WorkflowDisplay = React.createClass({
    /** Enables two-way databinding with Backbone model */
    mixins: [ModelMixin, LayeredComponentMixin],

    /** Activates databinding for `workflow` model property. */
    getBackboneModels: function() {
      return [this.props.workflow];
    },
    getInitialState: function() {
      return {
        /** Index number of first thumbnail picture */
        thumbStart: 0,
        /** Number of thumbnails to display */
        thumbCount: 24,
        /** Image to display in a lightobx overlay */
        lightboxImage: undefined,
        lightboxNext: undefined,
        lightboxPrevious: undefined,
	lightboxPage: undefined,
        imageType: 'raw',
        selectedPages: []
      };
    },
    /**
     * Toggle display of image lightbox.
     *
     * If no `img` parameter is passed, the lightbox will be disabled,
     * otherwise it will be enabled with the `img` as its content.
     *
     * @param {string} [img] - URL for image to be displayed in lightbox
     */
    toggleLightbox: function(workflow, page) {
      var changed = undefined;
      if (this.state.lightboxPage)
      {
	var hints = this.state.lightboxPage.postprocessing_hints;
	var section = this.state.lightboxSection;
	if (section !== '' && hints && section !== hints.section)
	{
	  hints.section = section;
	  changed = this.state.lightboxPage;
	}
	var color = this.state.lightboxColor;
	if (color !== '' && color !== hints.color)
	{
	  hints.color = color;
	  changed = this.state.lightboxPage;
	}
      }
      var image, next, previous;
      if (page) {
        var allPages = workflow.get('pages'),
            pageIdx = allPages.indexOf(page);
        image = util.getPageUrl(this.props.workflow, page.capture_num,
                                this.state.imageType, false);
        next = (pageIdx != (allPages.length-1)) && allPages[pageIdx+1];
        previous = (pageIdx != 0) && allPages[pageIdx-1];
      }
      var getKeyIfAvailable = function (key, defaultValue) {
	var result = defaultValue;
	if (page && page.postprocessing_hints[key])
	{
	  result = page.postprocessing_hints[key];
	}
	else if (previous && previous.postprocessing_hints[key])
	{
	  result = previous.postprocessing_hints[key];
	}
	return result;
      }.bind(this);
      this.setState({
        lightboxImage: image,
        lightboxNext: next,
        lightboxPrevious: previous,
	lightboxPage: page,
	lightboxSection: getKeyIfAvailable('section', ''),
	lightboxColor: getKeyIfAvailable('color', '')
      });
      if (changed)
      {
	this.props.workflow.updatePage(changed);
      }
    },
    /**
     * Change page of page thumbnail display.
     *
     * @param {number} pageIdx - Page number to chagne to
     */
    browse: function(pageIdx) {
      var thumbStart = (pageIdx)*this.state.thumbCount;
      if (thumbStart%this.state.thumbCount == 0) {
        thumbStart = (pageIdx-1)*this.state.thumbCount;
      }
      this.setState({
        thumbStart: thumbStart
      });
    },
    togglePageSelect: function(page) {
      var pages = this.state.selectedPages;
      if (_.contains(pages, page)) {
        this.setState({selectedPages: _.without(pages, page)});
      } else {
        pages.push(page);
        this.setState({selectedPages: pages});
      }
    },
    bulkDelete: function() {
      this.props.workflow.deletePages({pages: this.state.selectedPages});
    },
    handleImageTypeSelect: function(event) {
      this.setState({
        imageType: event.target.value
      });
    },
    render: function() {
      var workflow = this.props.workflow,
          pages = workflow.get('pages'),
          pageCount = Math.ceil(pages.length / this.state.thumbCount),
          thumbStart = this.state.thumbStart,
          thumbStop = this.state.thumbStart+this.state.thumbCount,
          deleteClasses = require('react/addons').addons.classSet({
            'small': true,
            'button': true,
            'disabled': this.state.selectedPages.length === 0
          }),
          imageTypes = ['raw'],
          metadata = workflow.get('metadata');
          if (pages.length > 0) {
            imageTypes = imageTypes.concat(_.without(_.keys(pages[0].processed_images),
                                                     'tesseract'));
          }
      return (
        <main>
          <F.Row>
            <F.Column>
              <h1>{metadata.title}</h1>
            </F.Column>
          </F.Row>
          <F.Row className="metadata-view">
            <F.Column>
              <h2>Metadata</h2>
              {_.map(window.metadataSchema, function(field) {
                if (!_.has(metadata, field.key)) return;
                var valueNode,
                    value = metadata[field.key];
                if (field.multivalued) {
                  valueNode = (
                    <ul>
                    {_.map(value, function(item) {
                      return <li key={item}>{item}</li>;
                    })}
                    </ul>);
                } else {
                  valueNode = value;
                }
                return (
                  <F.Row key={field.key}>
                    <F.Column size={[4, 2]}>{field.description}</F.Column>
                    <F.Column size={[8, 10]}>{valueNode}</F.Column>
                  </F.Row>);
                })}
            </F.Column>
          </F.Row>

          {/* Only show image thumbnails when there are images in the workflow */}
          {pages.length > 0 &&
          <section>
            <F.Row>
              <F.Column>
                <h2>Pages</h2>
              </F.Column>
            </F.Row>
            <F.Row>
              <F.Column size={[6, 8]}>
                <F.Button onClick={this.bulkDelete} size="small"
                          className={deleteClasses} title="Delete">
                  <i className="fa fa-trash-o" />
                </F.Button>
              </F.Column>
              <F.Column size={[4, 2]} offset={2}>
                <select className="format-select"
                        onChange={this.handleImageTypeSelect}>
                  {imageTypes.map(function(name) {
                    return <option key={name} value={name}>{name}</option>;
                  })}
                </select>
              </F.Column>
            </F.Row>
                <ul ref="pagegrid" className="pagegrid small-block-grid-2 medium-block-grid-4 large-block-grid-6">
                  {pages.slice(thumbStart, thumbStop).map(function(page) {
                      return (
                        <PagePreview page={page} workflow={workflow} key={page.capture_num} imageType={this.state.imageType}
                                    selected={_.contains(this.state.selectedPages, page)}
                                    selectCallback={_.partial(this.togglePageSelect, page)}
                                    lightboxCallback={_.partial(this.toggleLightbox, workflow, page)} />
                      );
                    }.bind(this))}
                </ul>
                {pageCount > 1 && <F.Pagination centered={true} pageCount={pageCount} onBrowse={this.browse} />}
          </section>}

          {/* Only show output file list if there are output files in the workflow */}
          {!_.isEmpty(workflow.get('out_files')) &&
          <F.Row>
            <F.Column>
              <h2>Output files</h2>
              <ul ref="outputlist" className="fa-ul">
                {_.map(workflow.get('out_files'), function(outFile) {
                    var fileUrl = '/api/workflow/' + this.props.workflow.id + '/output/' + outFile.name,
                        classes = {
                          'fa-li': true,
                          'fa': true,
                        };
                    if (outFile.mimetype === "text/html") classes['fa-file-code-o'] = true;
                    else if (outFile.mimetype === "application/pdf") classes['fa-file-pdf-o'] = true;
                    else classes['fa-file'] = true;
                    return (
                      <li key={outFile.name}><a href={fileUrl}><i className={React.addons.classSet(classes)} /> {outFile.name}</a></li>
                    );
                  }, this)}
              </ul>
            </F.Column>
          </F.Row>}
        </main>
      );
    },

    renderLayer: function() {
      console.log(this.state.lightboxNext, this.state.lightboxPrevious);
      var rotateClass = 'imageLeft';
      if (this.state.lightboxPage && this.state.lightboxPage.is_odd
	  && this.props.workflow.get('config').device.upside_down)
      {
	rotateClass = 'imageRight';
      }
      if (this.state.lightboxImage) {
        var handleNext;
        if (this.state.lightboxNext) {
          handleNext = function(e) {
            e.stopPropagation();
            this.toggleLightbox(this.props.workflow, this.state.lightboxNext);
          }.bind(this);
        }
        var handlePrevious;
        if (this.state.lightboxPrevious) {
          handlePrevious = function(e) {
            e.stopPropagation();
            this.toggleLightbox(this.props.workflow, this.state.lightboxPrevious);
          }.bind(this);
        }

	var handleZoom = function (e) {
	  e.stopPropagation();
	  window.open(this.state.lightboxImage);
	  this.toggleLightbox(null, null);
	}.bind(this);

	var handleDone = function (e) {
	  e.stopPropagation();
	  this.toggleLightbox(null, null);
	}.bind(this);

	var handleChangeColor = function (e) {
	  this.setState({ lightboxColor: e.target.value });
	}.bind(this);

	var handleChangeSection = function (e) {
	  this.setState({ lightboxSection: e.target.value });
	}.bind(this);

        return (
          <Overlay>
	    <div className={rotateClass}>
	      <a onClick={handleZoom}>
	        <img src={this.state.lightboxImage} />
	      </a>
	    </div>
	    <div className="page-form">
	        <fieldset>
	          <legend>Page Metadata</legend>
	          <label>Section
	            <input id="section" type="text" value={this.state.lightboxSection} onChange={handleChangeSection}/>
	          </label>
	        </fieldset>
	        <fieldset>
	          <legend>Postprocessing Hints</legend>
	          <label>Color Range
	            <select id="color" value={this.state.lightboxColor} onChange={handleChangeColor}>
	              <option value=""></option>
	              <option value="binary">Binary</option>
	              <option value="grayscale">Grayscale</option>
	              <option value="color">Full Color</option>
	            </select>
	          </label>
	        </fieldset>
	        {handlePrevious && <button onClick={handlePrevious}>Previous</button>}
	        <button onClick={handleDone}>Done</button>
	        {handleNext && <button onClick={handleNext}>Next</button>}
	    </div>
          </Overlay>);
      }
    }
  });

  module.exports = WorkflowDisplay;
}());
