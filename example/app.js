var App = Ember.Application.create();

App.Boards = ['common', 'intermediate', 'advanced'];


// Models

App.Store = DS.Store.extend({
  adapter: EmberCouchDBKit.DocumentAdapter.create({db: 'boards'})
});

App.Store.registerAdapter('App.Attachment', EmberCouchDBKit.AttachmentAdapter.extend({db: 'boards'}));

App.Issue = DS.Model.extend({
  text: DS.attr('string'),
  type: DS.attr('string', {defaultValue: 'issue'}),
  attachments: DS.hasMany('App.Attachment', {embedded: true})
});

App.Attachment = DS.Model.extend({
  content_type: DS.attr('string'),
  length: DS.attr('number'),
  file_name: DS.attr('string'),
  db: DS.attr('string', {defaultValue: 'boards'})
});

App.Position = DS.Model.extend({
  issues: DS.hasMany('App.Issue'),
  type: DS.attr('string', {defaultValue: 'position'})
});


// Routes

App.IndexRoute = Ember.Route.extend({

  setupController: function(controller, model) {
    this._setupPositionHolders();
    this._position();
    this._issue();
  },

  renderTemplate: function() {
    this.render();
    // link particular controller with its outlet
    self = this;
    App.Boards.forEach(function(label) {
       self.render('board',{outlet: label, into: 'index', controller: label});
    });
  },

  _setupPositionHolders: function() {
    self = this;
    App.Boards.forEach(function(type) {
      // set issues into appropriate controller through position model
      position = App.Position.find(type);
      position.one('didLoad', function() {
        self.controllerFor(type).set('position', this);
      });
      // create position documents (as a part of first time initialization)
      if (position.get('store.adapter').is(404, {for: type})) {
        App.Position.createRecord({ id: type }).get('store').commit();
      }
    });
  },

  _position: function(){
    // create a CouchDB `/_change` listener which serves an position documents
    params = { include_docs: true, timeout: 100, filter: 'issues/only_positions'}
    position = EmberCouchDBKit.ChangesFeed.create({ db: 'boards', content: params });

    // all upcoming changes are passed to `_handlePositionChanges` callback through `longpoll` strategy
    self = this;
    position.fromTail(function(){
      position.longpoll(self._handlePositionChanges, self);
    });
  },

  _handlePositionChanges: function(data) {
    self = this;
    data.forEach(function(obj){
      position = self.controllerFor(obj.doc._id).get('position');
      // we should reload particular postion model in case of update is received from another user
      if (position.get('_data.raw._rev') != obj.doc._rev)
        position.reload();
    });
  },

  _issue: function() {
    // create a CouchDB `/_change` issue listener which serves an issues
    params = { include_docs: true, timeout: 100, filter: 'issues/issue'}
    issue = EmberCouchDBKit.ChangesFeed.create({ db: 'boards', content: params });

    // all upcoming changes are passed to `_handleIssueChanges` callback through `fromTail` strategy
    self = this;
    issue.fromTail(function(){
      issue.longpoll(self._handleIssueChanges, self);
    });
  },

  _handleIssueChanges: function(data) {
    self = this;
    // apply received updates
    data.forEach(function(obj){
      issue = App.Issue.find(obj.doc._id);
      if(issue.get('isLoaded')){
        issue.reload();
      }
    });
  }
});



// Controllers

App.IndexController = Ember.Controller.extend({

  content: Ember.computed.alias('position.issues'),

  createIssue: function(text) {
    issue = App.Issue.createRecord({text: text});
    issue.save();

    self = this;
    issue.addObserver('id', function(sender, key, value, context, rev) {
      self.get('position.issues').pushObject(this);
      self.get('position').save();
    });
  },
  saveMessage: function(model) {
    model.save();
  },
  deleteMessage: function(issue) {
    issue.deleteRecord();
    issue.get('store').commit();
  },
  deleteAttachment: function(attachment){
    // attachment.deleteRecord();
    // attachment.get('store').commit();
  },
  browseFile: function(viewId) {
    document.getElementById(viewId).click();
  },
  addAttachment: function(file, model){
    issue = model.get('_data.raw');
    attachmentId = "%@/%@".fmt(model.id, file.name);
    params = {
      doc_id: model.id,
      doc_type: App.Issue,
      rev: issue._rev,
      id: attachmentId,
      file: file,
      content_type: file.type,
      length: file.size,
      file_name: file.name
    }
    attachment = App.Attachment.createRecord(params);
    attachment.get('store').commit();
  },
  needs: App.Boards
});

App.CommonController       = App.IndexController.extend({ name: 'common' });
App.IntermediateController = App.IndexController.extend({ name: 'intermediate' });
App.AdvancedController     = App.IndexController.extend({ name: 'advanced' });



//  Views

App.IssueView = Ember.View.extend({
  tagName: "form",
  edit: false,
  attributeBindings: ['draggable'],
  draggable: 'true',

  submit: function(event){
    event.preventDefault();
    if (this.get('edit')){
      this.get('controller').send("saveMessage", this.get('context') );
    }
    this.toggleProperty('edit');
  },

  dragStart: function(event) {
    event.dataTransfer.setData('id', this.get('elementId'));
  },

  dragEnter: function(event) {
    event.preventDefault();
    event.target.style.opacity = '0.4';
  },

  dragOver: function(event) {
    event.preventDefault();
  },

  dragLeave: function(event) {
    event.preventDefault();
    event.target.style.opacity = '1';
  },

  drop: function(event) {
    var viewId = event.dataTransfer.getData('id');
    var view = Ember.View.views[viewId];
    var newModel = view.get('context');
    var oldModel = this.get('context');
    var position = this.get('controller.content').toArray().indexOf(oldModel)

    view.get('controller.content').removeObject(newModel);
    thisArray = this.get('controller.content').toArray().insertAt(position, newModel);

    this.set('controller.position.issues.content', thisArray.getEach('_reference'));
    this.get('controller.position').save();

    if(view.get('controller.name') !== this.get('controller.name')){
      newModel.set('board', this.get('controller.name'));
      newModel.get('store').commit();
      viewArray = view.get('controller.content').toArray();
      view.set('controller.content.content', viewArray.getEach('_reference'));
      view.get('controller.position').save();
    }

    event.preventDefault();
    event.target.style.opacity = '1';
  }
});

App.NewIssueView = Ember.View.extend({

  tagName: "form",
  create: false,
  attributeBindings: ["style"],
  style: "display:inline",

  submit: function(event){
    this._save(event);
  },

  keyDown: function(event){
    if(event.keyCode == 13){
      this._save(event);
    }
  },

  _save: function(event) {
    event.preventDefault();
    if (this.get('create')){
      this.get('controller').send("createIssue", this.get("TextArea.value"));
    }
    this.toggleProperty('create');
  }
});

App.CancelView = Ember.View.extend({
  tagName: "span",
  
  click: function(event){
    event.preventDefault();
    this.set('parentView.create',false);
  }
});

App.DeleteIssueView = Ember.View.extend({
  tagName: "span",

  click: function(event){
    event.preventDefault();
    this.get('controller').send('deleteMessage', this.get('context'));
  }
});

App.DeleteAttachmentView = Ember.View.extend({
  tagName: "span",
  classNames: ['badge'],
  click: function(event){
    event.preventDefault();
    this.get('controller').send('deleteAttachment', this.get('context'));
  }
});


App.AttachmentView = Ember.View.extend({
  
  tagName: "input",
  attributeBindings: ["style", "type", "multiple"],
  style: "display:none",
  type: 'file',
  multiple: true,
  
  change: function(event) {
    var files = event.target.files;
    for (var i = 0, file; file = files[i]; i++) {
      if (!file.type.match('image.*')) {
        continue;
      }
      this.get('controller').send('addAttachment', file, this.get('context'));
    }
  }
});

Ember.TextArea.reopen({
  attributeBindings: ['autofocus','viewName'],
  autofocus: 'autofocus'
});

Ember.Handlebars.helper('linkToAttachment', function(attachment) {
  return new Handlebars.SafeString(
    "<a href='" + "/%@/%@".fmt( attachment.get('_data.db'), attachment.get('id') + "' target='_blank'>" + attachment.get('file_name') + ";</a>"
  ));
});
