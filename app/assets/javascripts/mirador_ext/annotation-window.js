(function($) {

  $.AnnotationWindow = function(options) {
    jQuery.extend(this, {
      id: null,
      appnedTo: null,
      element: null,
      canvasWindow: null, // window that contains the canvas for the annotations
      endpoint: null
    }, options);
    
    console.log('AnnotationWindow this.appendTo id: ' + this.appendTo.attr('id'));

    this.init();
  };

  $.AnnotationWindow.prototype = {
    
    init: function () {
      this.miradorProxy = $.getMiradorProxy();
      if (!this.id) {
        this.id = Mirador.genUUID();
      }
      var viewer = $.mirador.viewer;
      this.canvasWindow = this.miradorProxy.getFirstWindow();
      this.endpoint = this.canvasWindow.endpoint;
      this.element = jQuery(this.template({}));
      this.appendTo.append(this.element);
      
      this.layerSelector = new $.Selector({
        appendTo: this.element.find('.layer_selector_container')
      });
      
      this.editorRow = this.element.find('.annowin_creator'); // placeholder for annotation editor for creation
      this.placeholder = this.element.find('.placeholder');
      this.placeholder.text('Loading...').show();
      
      this.reload();
      this.bindEvents();
    },

    // Should run when either the layer or the annotationsList for this
    // window is updated.
    updateAnnoMgr: function(layerId) {
      this.annoMgr = new $.AnnotationsManager(layerId, this.canvasWindow.annotationsList);
    },
    
    reload: function(skipLayerLoading) {
      console.log('RELOAD');
      var _this = this;
      this.placeholder.hide();
      var canvas = this.getCurrentCanvas();
      this.element.find('.title').text(canvas.label);
      var dfd = jQuery.Deferred();
      
      if (skipLayerLoading) {
        dfd.resolve();
      } else {
        this.updateLayers(dfd);
      }

      dfd.done(function() {
        var layerId = _this.layerSelector.val();
        _this.updateAnnoMgr(layerId);
        _this.updateList(layerId);
      });
    },
    
    updateLayers: function(dfd) {
      var _this = this;
      var layers = this.endpoint.annotationLayers;
      var selector = this.layerSelector
      
      selector.empty();
      jQuery.each(layers, function(index, value) {
        selector.addItem(value.label, value['@id']);
      })
      setTimeout(function() {
        if (layers.length > 0) {
          selector.val(layers[0]['@id']);
        }
        dfd.resolve();
      }, 0);
      return dfd;
    },
    
    updateList: function(layerId) {
      var _this = this;
      var annotationsList = this.canvasWindow.annotationsList;
      
      this.listElem = this.element.find('.annowin_list');
      this.listElem.empty();
      
      var count = 0;
      
      jQuery.each(annotationsList, function(index, value) {
        try {
          if (layerId === 'any' || layerId === value.layerId) {
            ++count;
            _this.addAnnotation(value);
          }
        } catch (e) {
          console.log('ERROR AnnotationWindow#updateList ' + e);
        }
      });
      
      if (count === 0) {
        this.placeholder.text('No annotations found.').show();
      } else {
        this.placeholder.hide();
      }
    },
    
    addAnnotation: function(annotation) {
      //console.log('AnnotationWindow#addAnnotation:');
      //console.dir(annotation);
      var content = annotation.resource[0].chars;
      var annoHtml = this.annotationTemplate({content: content});
      var annoElem = jQuery(annoHtml);
      var infoDiv = annoElem.find('.info_view');
      
      annoElem.data('annotationId', annotation['@id']);
      annoElem.find('.ui.dropdown').dropdown({
        onChange: function (value, text, $selectedItem) {
          setTimeout(function () {
            annoElem.find('ui.dropdown').dropdown('restore defaults');
          }, 1000);
        }
      });
      if (annotation.on['@type'] == 'oa:Annotation') { // target: annotation
        annoElem.find('.menu_bar').addClass('targeting_anno');
      } else {
        annoElem.find('.menu_bar').removeClass('targeting_anno');
      }
      this.setAnnotationItemInfo(annoElem, annotation);
      this.bindAnnotationItemEvents(annoElem, annotation);
      infoDiv.hide();
      this.listElem.append(annoElem);
    },
    
    setAnnotationItemInfo: function(annoElem, annotation) {
      var infoElem = annoElem.find('.annowin_info');
      if (annotation.on['@type'] == 'oa:Annotation') { // target: annotation
        infoElem.addClass('anno_on_anno');
      } else {
        infoElem.removeClass('anno_on_anno');
      }
    },
    
    getCurrentCanvas: function() {
      var window = this.canvasWindow;
      var id = window.canvasID;
      var canvases = window.manifest.getCanvases();
      return canvases.filter(function (canvas) {
        return canvas['@id'] === id;
      })[0];
    },
    
    highlightFocusedAnnotation: function(annotation) {
      this.listElem.find('.annowin_anno').each(function(index, value) {
        var annoElem = jQuery(value);
        var annoID = annoElem.data('annotationId');
        if (annoID === annotation['@id']) {
          annoElem.addClass('mr_anno_selected');
        } else {
          annoElem.removeClass('mr_anno_selected');
        }
      });
    },

    highlightAnnotations: function(annotations, flag) {
      var _this = this;
      var klass = (flag == 'TARGETING' ? 'mr_anno_targeting' : 'mr_anno_targeted');
      
      this.listElem.find('.annowin_anno').each(function(index, value) {
        var annoElem = jQuery(value);
        var annoId = annoElem.data('annotationId');
        var matched = false;
        var firstMatch = true;
        
        jQuery.each(annotations, function(index, value) {
          var targetAnnotationId = value['@id'];
          if (annoId === targetAnnotationId) {
            matched = true;
            annoElem.addClass(klass);
            if (firstMatch) {
              _this.scrollToElem(annoElem);
              firstMatch = false;
            }
          }
        });
        if (!matched) {
          annoElem.removeClass(klass);
        }
      });
    },
    
    scrollToElem: function(annoElem) {
      console.log('top: ' + annoElem.position().top);
      this.listElem.animate({
        scrollTop: annoElem.position().top
      }, 250);
    },
    
    clearHighlights: function() {
      this.listElem.find('.annowin_anno').each(function(index, value) {
        jQuery(value).removeClass('annowin_targeted')
          .removeClass('mr_anno_selected mr_anno_targeting mr_anno_targeted');
      });
    },
    
    createInfoDiv: function(annotation, callback) {
      var targetAnnoID = annotation.on.full;
      var targetLink = '<a target="_blank" href="' + targetAnnoID + '">' + targetAnnoID + '</a>';
      return jQuery(this.infoTemplate({ on: targetLink }));
    },
    
    bindEvents: function() {
      var _this = this;
      
      // When a new layer is selected
      this.layerSelector.changeCallback = function (label, value) {
        var layerId = _this.layerSelector.val();
        _this.updateAnnoMgr(layerId);
        _this.updateList(layerId);
      };
      
      this.miradorProxy.subscribe('ANNOTATIONS_LIST_UPDATED', function(event, windowId, annotationsList) {
        _this.reload(true);
      });
      
      jQuery.subscribe('ANNOTATION_FOCUSED', function(event, annoWinId, annotation) {
        console.log('Annotation window ' + _this.id + ' received annotation_focused event');
        console.log('Layer: ' + _this.annoMgr.layerId);
        
        if (annoWinId !== _this.id) {
          var targetID = annotation.on.full;
          _this.clearHighlights();
          var annotationsList = _this.canvasWindow.annotationsList;
          var targeting = _this.annoMgr.findTargetingAnnotations(annotation);
          console.log('TARGETING: '); console.dir(targeting);
          var targeted = _this.annoMgr.findTargetAnnotations(annotation);
          console.log('TARGETED: '); console.dir(targeted);
          _this.highlightAnnotations(targeting, 'TARGETING');
          _this.highlightAnnotations(targeted, 'TARGET');
        }
      });
      
      this.eventEmitter.subscribe(('currentCanvasIDUpdated.' + this.canvasWindow.id), function(event) {
        _this.placeholder.text('Loading...').show();
      });
    },
    
    bindAnnotationItemEvents: function(annoElem, annotation) {
      var _this = this;
      var infoElem = annoElem.find('.annowin_info');
      
      annoElem.click(function(event) {
        if ($.getLinesOverlay().isActive()) {
          jQuery.publish('target_annotation_selected', annotation);
        } else {
          _this.clearHighlights();
          _this.highlightFocusedAnnotation(annotation);
          _this.miradorProxy.publish('ANNOTATION_FOCUSED', [_this.id, annotation]);
          jQuery.publish('ANNOTATION_FOCUSED', [_this.id, annotation]);
        }
      });
      
      annoElem.find('.annotate').click(function (event) {
        var dialogElement = jQuery('#mr_annotation_dialog');
        var dfdOnSave = jQuery.Deferred();
        var dfdOnCancel = jQuery.Deferred();
        var editor = new $.AnnotationEditor({
          parent: dialogElement,
          canvasWindow: _this.canvasWindow,
          mode: 'create',
          targetAnnotation: annotation,
          endpoint: _this.endpoint
        });
        new $.AnnotationDialog({ 
          element: dialogElement, 
          editor: editor
        });
        dfdOnSave
      });
      
      annoElem.find('.edit').click(function (event) {
        var editor = new $.AnnotationEditor({
          parent: annoElem,
          canvasWindow: _this.canvasWindow,
          mode: 'update',
          endpoint: _this.endpoint,
          annotation: annotation,
          closedCallback: function () {
            annoElem.find('.normal_view').show();
          }
        });
        
        annoElem.find('.normal_view').hide();
        editor.show();
      });
      
      annoElem.find('.delete').click(function (event) {
        if (window.confirm('Do you really want to delete the annotation?')) {
          _this.miradorProxy.publish('annotationDeleted.' + _this.canvasWindow.id, [annotation['@id']]);
        }
      });
      
      infoElem.click(function(event) {
        var infoDiv = annoElem.find('.info_view');
        if (infoDiv.css('display') === 'none') {
          infoDiv.replaceWith(_this.createInfoDiv(annotation));
          infoDiv.show();
        } else {
          infoDiv.hide();
        }
      });
    },
    
    // template should be based on workspace type
    template: Handlebars.compile([
      '<div class="mr_annotation_window">',
      '  <div class="annowin_header">',
      '    <div class="annowin_layer_row">', 
      '      <span class="layer_selector_container"></span>',
      '    </div>',
      '  </div>',
      '  <div class="annowin_creator"></div>',
      '  <div class="placeholder"></div>',
      '  <div class="annowin_list">',
      '  </div>',
      '</div>'
    ].join('')),
    
    annotationTemplate: Handlebars.compile([
      '<div class="annowin_anno">',
      '  <div class="info_view"></div>',
      '  <div class="normal_view">',
      '    <div class="menu_bar">',
      '      <div class="ui text menu">',
      '        <div class="ui dropdown item">',
      '          Action<i class="dropdown icon"></i>',
      '          <div class="menu">',
      '            <div class="annotate item"><i class="fa fa-hand-o-left fa-fw"></i> Annotate</div>',
      '            <div class="edit item"><i class="fa fa-edit fa-fw"></i> {{t "edit"}}</div>',
      '            <div class="delete item"><i class="fa fa-times fa-fw"></i> {{t "delete"}}</div>',
      '          </div>',
      '        </div>',
      '      </div>',
      '    </div>',
      '    <div class="content">{{{content}}}</div>',
      '  </div>',
      '</div>'
    ].join('')),
    
    infoTemplate: Handlebars.compile([
      '<div class="info_view">',
      '  <span class="anno_info_label">On:<span>',
      '  <span class="anno_info_value">{{{on}}}</span>',
      '</div>'
    ].join(''))
  };

})(MR);