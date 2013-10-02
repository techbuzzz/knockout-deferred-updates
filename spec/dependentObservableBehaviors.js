
describe('Dependent Observable', function() {
    it('Should be subscribable', function () {
        var instance = new ko.dependentObservable(function () { });
        expect(ko.isSubscribable(instance)).toEqual(true);
    });

    it('Should advertise that instances are observable', function () {
        var instance = new ko.dependentObservable(function () { });
        expect(ko.isObservable(instance)).toEqual(true);
    });

    it('Should advertise that instances are computed', function () {
        var instance = new ko.dependentObservable(function () { });
        expect(ko.isComputed(instance)).toEqual(true);
    });

    it('Should advertise that instances cannot have values written to them', function () {
        var instance = new ko.dependentObservable(function () { });
        expect(ko.isWriteableObservable(instance)).toEqual(false);
    });

    it('Should require an evaluator function as constructor param', function () {
        var threw = false;
        try { var instance = new ko.dependentObservable(); }
        catch (ex) { threw = true; }
        expect(threw).toEqual(true);
    });

    it('Should be able to read the current value of the evaluator function', function () {
        var instance = new ko.dependentObservable(function () { return 123; });
        expect(instance()).toEqual(123);
    });

    it('Should not be able to write a value to it if there is no "write" callback', function () {
        var instance = new ko.dependentObservable(function () { return 123; });

        var threw = false;
        try { instance(456); }
        catch (ex) { threw = true; }

        expect(instance()).toEqual(123);
        expect(threw).toEqual(true);
    });

    it('Should invoke the "write" callback, where present, if you attempt to write a value to it', function() {
        var invokedWriteWithValue, invokedWriteWithThis;
        var instance = new ko.dependentObservable({
            read: function() {},
            write: function(value) { invokedWriteWithValue = value; invokedWriteWithThis = this; }
        });

        var someContainer = { depObs: instance };
        someContainer.depObs("some value");
        expect(invokedWriteWithValue).toEqual("some value");
        expect(invokedWriteWithThis).toEqual(function(){return this;}.call()); // Since no owner was specified
    });

    it('Should be able to write to multiple computed properties on a model object using chaining syntax', function() {
        var model = {
            prop1: ko.computed({
                read: function(){},
                write: function(value) {
                    expect(value).toEqual("prop1");
                } }),
            prop2: ko.computed({
                read: function(){},
                write: function(value) {
                    expect(value).toEqual("prop2");
                } })
        };
        model.prop1('prop1').prop2('prop2');
    });

    it('Should invoke the read function (and trigger notifications) if the write function updates dependent observables', function() {
        var observable = ko.observable();
        var computed = ko.dependentObservable({
            read: function() { return observable(); },
            write: function(value) { observable(value); }
        });
        var notifiedValue;
        computed.subscribe(function(value) {
            notifiedValue = value;
        });

        // Initially undefined
        expect(computed()).toEqual(undefined);
        expect(notifiedValue).toEqual(undefined);

        // Update computed and verify that correct notification happened
        computed("new value");
        ko.processAllDeferredUpdates();
        expect(notifiedValue).toEqual("new value");
    });

    it('Should use options.owner as "this" when invoking the "write" callback, and can pass multiple parameters', function() {
        var invokedWriteWithArgs, invokedWriteWithThis;
        var someOwner = {};
        var instance = new ko.dependentObservable({
            read: function() {},
            write: function() { invokedWriteWithArgs = Array.prototype.slice.call(arguments, 0); invokedWriteWithThis = this; },
            owner: someOwner
        });

        instance("first", 2, ["third1", "third2"]);
        expect(invokedWriteWithArgs.length).toEqual(3);
        expect(invokedWriteWithArgs[0]).toEqual("first");
        expect(invokedWriteWithArgs[1]).toEqual(2);
        expect(invokedWriteWithArgs[2]).toEqual(["third1", "third2"]);
        expect(invokedWriteWithThis).toEqual(someOwner);
    });

    it('Should use the second arg (evaluatorFunctionTarget) for "this" when calling read/write if no options.owner was given', function() {
        var expectedThis = {}, actualReadThis, actualWriteThis;
        var instance = new ko.dependentObservable({
            read: function() { actualReadThis = this },
            write: function() { actualWriteThis = this }
        }, expectedThis);

        instance("force invocation of write");

        expect(actualReadThis).toEqual(expectedThis);
        expect(actualWriteThis).toEqual(expectedThis);
    });

    it('Should be able to pass evaluator function using "options" parameter called "read"', function() {
        var instance = new ko.dependentObservable({
            read: function () { return 123; }
        });
        expect(instance()).toEqual(123);
    });

    it('Should cache result of evaluator function and not call it again until dependencies change', function () {
        var timesEvaluated = 0;
        var instance = new ko.dependentObservable(function () { timesEvaluated++; return 123; });
        expect(instance()).toEqual(123);
        expect(instance()).toEqual(123);
        expect(timesEvaluated).toEqual(1);
    });

    it('Should automatically update value when a dependency changes', function () {
        var observable = new ko.observable(1);
        var depedentObservable = new ko.dependentObservable(function () { return observable() + 1; });
        expect(depedentObservable()).toEqual(2);

        observable(50);
        expect(depedentObservable()).toEqual(51);
    });

    it('Should be able to use \'peek\' on an observable to avoid a dependency', function() {
        var observable = ko.observable(1),
            computed = ko.dependentObservable(function () { return observable.peek() + 1; });
        expect(computed()).toEqual(2);

        observable(50);
        expect(computed()).toEqual(2);    // value wasn't changed
    });

    it('Should be able to use \'ko.ignoreDependencies\' within a computed to avoid dependencies', function() {
        var observable = ko.observable(1),
            computed = ko.dependentObservable(function () {
                return ko.ignoreDependencies(function() { return observable() + 1 } );
            });
        expect(computed()).toEqual(2);

        observable(50);
        expect(computed()).toEqual(2);    // value wasn't changed
    });

    it('Should unsubscribe from previous dependencies each time a dependency changes', function () {
        var observableA = new ko.observable("A");
        var observableB = new ko.observable("B");
        var observableToUse = "A";
        var timesEvaluated = 0;
        var depedentObservable = new ko.dependentObservable(function () {
            timesEvaluated++;
            return observableToUse == "A" ? observableA() : observableB();
        });

        expect(depedentObservable()).toEqual("A");
        expect(timesEvaluated).toEqual(1);

        // Changing an unrelated observable doesn't trigger evaluation
        observableB("B2");
        expect(timesEvaluated).toEqual(1);

        // Switch to other observable
        observableToUse = "B";
        observableA("A2");
        expect(depedentObservable()).toEqual("B2");
        expect(timesEvaluated).toEqual(2);

        // Now changing the first observable doesn't trigger evaluation
        observableA("A3");
        expect(timesEvaluated).toEqual(2);
    });

    it('Should notify subscribers of changes', function () {
        var notifiedValue;
        var observable = new ko.observable(1);
        var depedentObservable = new ko.dependentObservable(function () { return observable() + 1; });
        depedentObservable.subscribe(function (value) { notifiedValue = value; });

        ko.processAllDeferredUpdates();
        expect(notifiedValue).toEqual(undefined);
        observable(2);
        ko.processAllDeferredUpdates();
        expect(notifiedValue).toEqual(3);
    });

    it('Should notify "beforeChange" subscribers before changes', function () {
        var notifiedValue;
        var observable = new ko.observable(1);
        var depedentObservable = new ko.dependentObservable(function () { return observable() + 1; });
        depedentObservable.subscribe(function (value) { notifiedValue = value; }, null, "beforeChange");

        expect(notifiedValue).toEqual(undefined);
        observable(2);
        ko.processAllDeferredUpdates();
        expect(notifiedValue).toEqual(2);
        expect(depedentObservable()).toEqual(3);
    });

    it('Should only update once when each dependency changes, even if evaluation calls the dependency multiple times', function () {
        var notifiedValues = [];
        var observable = new ko.observable();
        var depedentObservable = new ko.dependentObservable(function () { return observable() * observable(); });
        depedentObservable.subscribe(function (value) { notifiedValues.push(value); });
        expect(observable.getSubscriptionsCount()).toEqual(1);
        observable(2);
        ko.processAllDeferredUpdates();
        expect(observable.getSubscriptionsCount()).toEqual(1);
        expect(notifiedValues.length).toEqual(1);
        expect(notifiedValues[0]).toEqual(4);
    });

    it('Should be able to chain dependentObservables', function () {
        var underlyingObservable = new ko.observable(1);
        var dependent1 = new ko.dependentObservable(function () { return underlyingObservable() + 1; });
        var dependent2 = new ko.dependentObservable(function () { return dependent1() + 1; });
        expect(dependent2()).toEqual(3);

        underlyingObservable(11);
        expect(dependent2()).toEqual(13);
    });

    it('Should be able to use \'peek\' on a computed observable to avoid a dependency', function () {
        var underlyingObservable = new ko.observable(1);
        var computed1 = new ko.dependentObservable(function () { return underlyingObservable() + 1; });
        var computed2 = new ko.dependentObservable(function () { return computed1.peek() + 1; });
        expect(computed2()).toEqual(3);
        expect(computed2.isActive()).toEqual(false);

        underlyingObservable(11);
        expect(computed2()).toEqual(3);    // value wasn't changed
    });

    it('Should accept "owner" parameter to define the object on which the evaluator function should be called', function () {
        var model = new (function () {
            this.greeting = "hello";
            this.fullMessageWithoutOwner = new ko.dependentObservable(function () { return this.greeting + " world" });
            this.fullMessageWithOwner = new ko.dependentObservable(function () { return this.greeting + " world" }, this);
        })();
        expect(model.fullMessageWithoutOwner()).toEqual("undefined world");
        expect(model.fullMessageWithOwner()).toEqual("hello world");
    });

    it('Should dispose and not call its evaluator function when the disposeWhen function returns true', function () {
        var underlyingObservable = new ko.observable(100);
        var timeToDispose = false;
        var timesEvaluated = 0;
        var dependent = new ko.dependentObservable(
            function () { timesEvaluated++; return underlyingObservable() + 1; },
            null,
            { disposeWhen: function () { return timeToDispose; } }
        );
        expect(timesEvaluated).toEqual(1);
        expect(dependent.getDependenciesCount()).toEqual(1);
        expect(dependent.isActive()).toEqual(true);

        timeToDispose = true;
        underlyingObservable(101);
        ko.processAllDeferredUpdates();
        expect(timesEvaluated).toEqual(1);
        expect(dependent.getDependenciesCount()).toEqual(0);
        expect(dependent.isActive()).toEqual(false);
    });

    it('Should dispose itself as soon as disposeWhen returns true, as long as it isn\'t waiting for a DOM node to be removed', function() {
        var underlyingObservable = ko.observable(100),
            dependent = ko.dependentObservable(
                underlyingObservable,
                null,
                { disposeWhen: function() { return true; } }
            );

        expect(underlyingObservable.getSubscriptionsCount()).toEqual(0);
        expect(dependent.isActive()).toEqual(false);
    });

    it('Should delay disposal until after disposeWhen returns false if it is waiting for a DOM node to be removed', function() {
        var underlyingObservable = ko.observable(100),
            shouldDispose = true,
            dependent = ko.dependentObservable(
                underlyingObservable,
                null,
                { disposeWhen: function() { return shouldDispose; }, disposeWhenNodeIsRemoved: true }
            );

        // Even though disposeWhen returns true, it doesn't dispose yet, because it's
        // expecting an initial 'false' result to indicate the DOM node is still in the document
        expect(underlyingObservable.getSubscriptionsCount()).toEqual(1);
        expect(dependent.isActive()).toEqual(true);


        // disposeWhen value is still true, so it won't be disposed
        underlyingObservable(101);
        ko.processAllDeferredUpdates();
        expect(dependent.getSubscriptionsCount()).toEqual(1);
        expect(dependent.isActive()).toEqual(true);

        // Trigger the false result. Of course it still doesn't dispose yet, because
        // disposeWhen says false.
        shouldDispose = false;
        underlyingObservable(102);
        ko.processAllDeferredUpdates();
        expect(underlyingObservable.getSubscriptionsCount()).toEqual(1);
        expect(dependent.isActive()).toEqual(true);

        // Now trigger a true result. This time it will dispose.
        shouldDispose = true;
        underlyingObservable(103);
        ko.processAllDeferredUpdates();
        expect(underlyingObservable.getSubscriptionsCount()).toEqual(0);
        expect(dependent.isActive()).toEqual(false);
    });

    it('Should describe itself as active if the evaluator has dependencies on its first run', function() {
        var someObservable = ko.observable('initial'),
            dependentObservable = new ko.dependentObservable(function () { return someObservable(); });
        expect(dependentObservable.isActive()).toEqual(true);
    });

    it('Should describe itself as inactive if the evaluator has no dependencies on its first run', function() {
        var dependentObservable = new ko.dependentObservable(function () { return 123; });
        expect(dependentObservable.isActive()).toEqual(false);
    });

    it('Should describe itself as inactive if subsequent runs of the evaluator result in there being no dependencies', function() {
        var someObservable = ko.observable('initial'),
            shouldHaveDependency = true,
            dependentObservable = new ko.dependentObservable(function () { return shouldHaveDependency && someObservable(); });
        expect(dependentObservable.isActive()).toEqual(true);

        // Trigger a refresh
        shouldHaveDependency = false;
        someObservable('modified');
        ko.processAllDeferredUpdates();
        expect(dependentObservable.isActive()).toEqual(false);
    });

    it('Should advertise that instances *can* have values written to them if you supply a "write" callback', function() {
        var instance = new ko.dependentObservable({
            read: function() {},
            write: function() {}
        });
        expect(ko.isWriteableObservable(instance)).toEqual(true);
    });

    it('Should allow deferring of evaluation (and hence dependency detection)', function () {
        var timesEvaluated = 0;
        var instance = new ko.dependentObservable({
            read: function () { timesEvaluated++; return 123 },
            deferEvaluation: true
        });
        expect(timesEvaluated).toEqual(0);
        expect(instance()).toEqual(123);
        expect(timesEvaluated).toEqual(1);
    });

    it('Should prevent recursive calling of read function', function() {
        var observable = ko.observable(0),
            computed = ko.dependentObservable(function() {
                // this both reads and writes to the observable
                // will result in errors like "Maximum call stack size exceeded" (chrome)
                // or "Out of stack space" (IE) or "too much recursion" (Firefox) if recursion
                // isn't prevented
                observable(observable() + 1);
            });
    });

    it('Should not subscribe to observables accessed through change notifications of a computed', function() {
        // See https://github.com/SteveSanderson/knockout/issues/341
        var observableDependent = ko.observable(),
            observableIndependent = ko.observable(),
            computed = ko.computed(function() { return observableDependent() });

        // initially there is only one dependency
        expect(computed.getDependenciesCount()).toEqual(1);

        // create a change subscription that also accesses an observable
        computed.subscribe(function() { observableIndependent() });
        // now trigger evaluation of the computed by updating its dependency
        observableDependent(1);
        // there should still only be one dependency
        expect(computed.getDependenciesCount()).toEqual(1);

        // also test with a beforeChange subscription
        computed.subscribe(function() { observableIndependent() }, null, 'beforeChange');
        observableDependent(2);
        expect(computed.getDependenciesCount()).toEqual(1);
    });

    it('Should not subscribe to observables accessed through change notifications of a modified observable', function() {
        // See https://github.com/SteveSanderson/knockout/issues/341
        var observableDependent = ko.observable(),
            observableIndependent = ko.observable(),
            observableModified = ko.observable(),
            computed = ko.computed(function() { observableModified(observableDependent()) });

        // initially there is only one dependency
        expect(computed.getDependenciesCount()).toEqual(1);

        // create a change subscription that also accesses an observable
        observableModified.subscribe(function() { observableIndependent() });
        // now trigger evaluation of the computed by updating its dependency
        observableDependent(1);
        // there should still only be one dependency
        expect(computed.getDependenciesCount()).toEqual(1);

        // also test with a beforeChange subscription
        observableModified.subscribe(function() { observableIndependent() }, null, 'beforeChange');
        observableDependent(2);
        expect(computed.getDependenciesCount()).toEqual(1);
    });

    it('Should not subscribe to observables accessed through change notifications of an accessed computed', function() {
        // See https://github.com/SteveSanderson/knockout/issues/341
        var observableDependent = ko.observable(),
            observableIndependent = ko.observable(),
            computedInner = ko.computed({read: function() { return observableDependent() }, deferEvaluation: true}),
            computedOuter = ko.computed({read: function() { return computedInner() }, deferEvaluation: true});

        // initially there are no dependencies (because they haven't been evaluated)
        expect(computedInner.getDependenciesCount()).toEqual(0);
        expect(computedOuter.getDependenciesCount()).toEqual(0);

        // create a change subscription on the inner computed that also accesses an observable
        computedInner.subscribe(function() { observableIndependent() });
        // now trigger evaluation of both computeds by accessing the outer one
        computedOuter();
        // there should be only one dependency for each
        expect(computedInner.getDependencies().length).toEqual(1);
        expect(computedOuter.getDependencies().length).toEqual(1);
    });

    it('Should be able to re-evaluate a computed that previously threw an exception', function() {
        var observable = ko.observable(true),
            computed = ko.computed(function() {
                if (!observable()) {
                    throw Error("Some dummy error");
                } else {
                    return observable();
                }
            });

        // Initially the computed value is true (executed sucessfully -> same value as observable)
        expect(computed()).toEqual(true);

        expect(function () {
            // Update observable to cause computed to throw an exception
            observable(false);
            computed();     // Evaluate to force update
        }).toThrow();

        // The value of the computed is now undefined, although currently it keeps the previous value
        expect(computed()).toEqual(true);

        // Update observable to cause computed to re-evaluate
        observable(1);
        expect(computed()).toEqual(1);
    });

    it('getDependencies sould return list of dependencies', function() {
        var observableA = ko.observable("A");
        var observableB = ko.observable("B");
        var observableToUse = ko.observable("A");
        var computed = ko.dependentObservable(function () {
            return observableToUse() == "A" ? observableA() : observableB();
        });

        expect(computed()).toEqual("A");
        expect(computed.getDependencies()).toEqual([observableToUse, observableA]);
        expect(observableA.getDependents()).toEqual([computed]);
        expect(observableB.getDependents()).toEqual([]);

        // Switch to other observable
        observableToUse("B");
        expect(computed()).toEqual("B");
        expect(computed.getDependencies()).toEqual([observableToUse, observableB]);
        expect(observableA.getDependents()).toEqual([]);
        expect(observableB.getDependents()).toEqual([computed]);
    });

    it('Should be able to pause/resume a computed using activeWhen', function() {
        var observable = ko.observable("A");
        var isActive = ko.observable(true);
        var computed = ko.computed(function () {
            return observable();
        });
        computed.activeWhen(isActive);   // intially active

        // When not paused, computed is updated normally
        expect(computed()).toEqual("A");
        observable("B");
        expect(computed()).toEqual("B");

        // When paused, computed value stays the same until unpaused
        isActive(false);
        observable("C");
        expect(computed()).toEqual("B");
        isActive(true);
        expect(computed()).toEqual("C");
    });

    it('Should expose a "notify" extender that can configure a computed to notify on all changes', function() {
        var notifiedValues = [];
        var observable = new ko.observable(1);
        var computed = new ko.computed(function () { return observable(); });
        computed.subscribe(function (value) { notifiedValues.push(value); });

        ko.processAllDeferredUpdates();
        expect(notifiedValues).toEqual([]);

        // Trigger update without changing value; the computed will not notify the change (default behavior)
        observable.valueHasMutated();
        ko.processAllDeferredUpdates();
        expect(notifiedValues).toEqual([]);

        // Set the computed to notify always
        computed.extend({ notify: 'always' });
        observable.valueHasMutated();
        ko.processAllDeferredUpdates();
        expect(notifiedValues).toEqual([1]);
    });

    // Borrowed from haberman/knockout (see knockout/knockout#359)
    it('Should allow long chains without overflowing the stack', function() {
        var depth = 5000;
        var first = ko.observable(0);
        var last = first;
        for (var i = 0; i < depth; i++) {
            (function() {
                var l = last;
                last = ko.computed(function() { return l() + 1; });
            })();
        }
        var all = ko.computed(function() { return last() + first(); });
        first(1);
        ko.processAllDeferredUpdates();
        expect(all()).toEqual(depth+2);
    });
});
