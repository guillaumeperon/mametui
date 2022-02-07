/*import Viz from "viz.js";
import { Module, render } from 'viz.js/full.render.js';
// main data structures
let macomps;
let mameasures;
// clusters, key: name, value: array of elts
let allClusters = {};
// default list of tags
let tagList = {
    "commons": "🔧",
    "sales": "🛒",
    "service": "🎧",
    "experience": "🌐",
    "SFS": "🚙" //https://www.utf8icons.com/character/128665/recreational-vehicle
};
/*
* Utility functions
*/
function clearPanel(thepanel) {
    thepanel.innerHTML = '';
    while (thepanel.firstChild) {
        thepanel.removeChild(thepanel.firstChild);
    }
}
/*
* Class to agregate data, metadata, stats of a component
*/
let uiTypes = new Set(["AuraDefinition", "AuraDefinitionBundle", "LightningComponentBundle", "ApexPage", "ApexComponent", "CustomSite", "FlexiPage", "Flow", "VFP", "AXAPX_VF", "CustomTab", "Layout", "HomePageComponent", "EmailTemplate"]);
let dataTypes = new Set(["StandardEntity", "CustomObject", "StaticResource", "CustomLabel", "Queue", "Document"]);
// Class about one metadata
class Cmpinfo {
    constructor() {
        this.subcmps = [];
        this.metrics = [];
        this.parents = [];
        this.children = [];
        this.tags = [];
        this.cluster = 'commons';
        this.active = false;
        this.color = "grey";
        this.shape = "rect";
        this.hidden = false;
    }
    // 
    get usePict() {
        //console.log( JSON.stringify(anode));
        var useTag = "&#10060 "; // not used
        if (this.active) {
            useTag = "&#9989 "; // in use
        }
        else {
            if (this.createdDate > confPane.youngDev)
                useTag = "&#9997 "; // in development
        }
        return useTag;
    }
    // generate graphviz node description
    gvNode() {
        // if (!nodeFilter(nd)) continue; // choose to display or not with filter class
        // TODO: do not calculate each time
        if (this.cmptype === "AuraDefinitionBundle" && this.auraType?.startsWith("event")) {
            this.shape = "rarrow";
            this.color = (this.auraType === "event_COMPONENT") ? "bisque" : "orange";
        }
        else if (this.cmptype === "FlexiPage") {
            this.shape = "tab";
            this.color = "aquamarine";
        }
        else if (uiTypes.has(this.cmptype)) {
            this.shape = "component";
            if (this.active)
                this.color = "khaki";
            if (this.cmptype === 'AuraDefinitionBundle' && this.auraType === 'event')
                this.color = 'orange';
        }
        else if (dataTypes.has(this.cmptype)) {
            this.shape = "box3d";
            if (this.active)
                this.color = "yellowgreen";
        }
        let nmodules = this.tags.map(n => tagList[n]).join('');
        //if(this.cluster==="commons") nmodules += tagList["commons"];
        let nodeprops = `label="${nmodules}${this.cmpname}",fillcolor=${this.color},shape=${this.shape}`;
        //if (this.entrypoint) nodeprops += ",shape=cds";
        if (this.cluster === "commons")
            nodeprops += ",penwidth=2,color=blue3";
        return `_${this.sfid} [${nodeprops}];\n`; // graphviz variable name can not start by number, put "_"
    }
    // generate graphviz description of links to related nodes
    gvEdge(relNodes) {
        let nodeMap = this.children.filter(childname => relNodes.hasOwnProperty(childname));
        /* // no edge between elements from commons
        if(this.hasOwnProperty('cluster') && this.cluster==="commons")
         nodeMap = nodeMap.filter(n=> !(macomps[n].hasOwnProperty('cluster') && macomps[n].cluster==="commons"));  */
        // graphviz variable name can not start by number, put "_"
        nodeMap = nodeMap.map(a => '_' + a);
        let cnodes = nodeMap.join(",");
        let outstring = (cnodes.length > 0) ? `_${this.sfid} -> { ${cnodes} };\n` : '';
        if (confPane.displayMetrics && this.metrics.length > 0)
            outstring += `{ _${this.metrics.join(',_')} } -> _${this.sfid} ;\n`;
        return outstring;
    }
}
// Class about one metric information
class Entryp {
    constructor() {
        this.nbcalls = 0;
        this.totaltime = 0;
        this.avgtime = 0;
        this.p95time = 0;
        this.color = "grey";
    }
    get keyname() {
        let cleanName = this.name.replace(/[ \-\(\)\/\.\<\>,]/g, "_");
        let kname = (this.cmptype + "_" + cleanName).toUpperCase();
        return kname;
    }
    gvNode() {
        // if (!nodeFilter(nd)) continue; // choose to display or not with filter class
        let nodeprops = `label="${this.name}",fillcolor=${this.color},shape=cds`;
        return `_${this.keyname} [${nodeprops}];\n`;
    }
}
/* APEX, VFP and triggers entrypoints are class methods
    format is variable:
     classname
     classname.methodname
     VF- /apex/classname
     VF- /apex/classname.methodname
     VFRemote- classname invoke(methodname)
 */
/*
macomps
mameasures

AXAPX_TBR_GETAPPOINTMENTSCONTROLLER_GETAPPOINTMENTS: {
  nbcalls: 106,
  totaltime: 0,
  avgtime: 6255.462264150943,
  p95time: 17413.75,
  name: "TBR_GetAppointmentsController.getAppointments",
  cmptype: "AXAPX",
},
*/
function mergeEVMONstats() {
    let eltsAll = {
        "AXAPX": Object.values(macomps).filter(a => (a.cmptype === "ApexClass" || a.cmptype === "ApexPage" || a.cmptype === "ApexComponent")),
        "VFP": Object.values(macomps).filter(a => (a.cmptype === "ApexPage" || a.cmptype === "ApexComponent")),
        "TRIGGER": Object.values(macomps).filter(a => (a.cmptype === "ApexTrigger"))
    };
    for (let k of Object.keys(mameasures)) {
        let v = mameasures[k];
        // search component, metadata associated with the measure
        let targetname = v.name;
        if (v.cmptype === "AXAPX") {
            //  the metric can be apex or vfremote or vfpage			
            if (targetname.startsWith('VF- ')) { // visual force pages
                targetname = targetname.replace(/^(VF- \/apex\/)/, "");
            }
            else {
                targetname = targetname.replace(/^(VFRemote- )/, "");
                targetname = targetname.replace(/( invoke\(.*\))/, "");
            }
        }
        if (v.cmptype === "VFP") {
            targetname = targetname.replace(/^\/apex\//, "");
        }
        targetname = targetname.replace(/(\.[^.]*)/, "");
        let targetList = eltsAll[v.cmptype].filter(a => (a.cmpname.replace(/(\.[^.]*)/, "") === targetname));
        if (targetList.length > 0) {
            let target = targetList[0];
            v.child = target.sfid;
            target.metrics.push(k);
            console.log(`Child component for ${v.cmptype} entryPoint ${v.name} is ${target.cmptype} ${target.cmpname}`);
        }
        else {
            console.log(`NO child component for ${v.cmptype} entryPoint ${v.name}`);
        }
    }
}
/*
 * Function to analyze data activity and cluster
 */
// Use list of active nodes and dependencies to tag active classes
function tagActiveComponents() {
    // tag all components as inactive first
    console.log("----------> TAGGING ACTIVE COMPONENTS");
    Object.values(macomps).forEach(m => { m.active = false; m.color = 'grey'; });
    // start with entry points
    let activs = [];
    for (let a of Object.values(macomps)) {
        if (a.metrics.length === 0)
            continue;
        a.active = true;
        a.color = 'cadetblue1';
        activs.push(a.sfid);
    }
    // A: loop on children to tag them active too
    while (true) {
        //console.log(`Loop on children, known actives: ${activs.length}:  ${activs.join(' ')}`);
        let newactivs = activs.flatMap(a => macomps[a].children.filter(b => macomps[b].active === false));
        newactivs = [...new Set(newactivs)];
        if (newactivs.length === 0)
            break;
        console.log(`Loop on children, known actives: ${activs.length}, adding ${newactivs.length} children`);
        //console.log(`Adding children, nb: ${newactivs.length}: ${newactivs.join(' ')}`);
        newactivs.forEach(a => { macomps[a].active = true; macomps[a].color = 'cadetblue1'; });
        activs = activs.concat(newactivs);
    }
    activs = [...new Set(activs)];
    console.log(`Added children of actives components, known actives: ${activs.length}`);
    // B:tag active AuraComponents that depend on an active component (apex class)
    // after "mergeAuraCmpToBundle()": AuraDefinition -> AuraDefinitionBundle 
    Object.values(macomps).filter(a => a.cmptype === 'AuraDefinitionBundle').forEach(m => {
        if (m.children.filter(c => macomps[c].active === true && macomps[c].cmptype === "ApexClass").length === 0)
            return;
        m.active = true;
        m.color = 'cadetblue1';
        activs.push(m.sfid);
    });
    activs = [...new Set(activs)];
    console.log(`Added AuraDefinitionBundle that call active apex, known actives: ${activs.length}`);
    // C: parents that are tests and mocks of active classes are taggued active
    while (true) {
        //console.log(`Loop on parent tests class, known actives: ${activs.length}`);
        let newactivs = activs.filter(a => macomps[a].cmptype === "ApexClass").flatMap(a => macomps[a].parents.filter(b => (macomps[b].cmptype === "ApexClass") && (macomps[b].active === false) && (b.toLowerCase().includes("test") || b.toLowerCase().includes("mock"))));
        newactivs = [...new Set(newactivs)];
        if (newactivs.length === 0)
            break;
        //console.log(`Adding parent that are tests, nb: ${newactivs.length}: ${newactivs.join(' ')}`);
        newactivs.forEach(a => { macomps[a].active = true; macomps[a].color = 'cadetblue1'; });
        activs = activs.concat(newactivs);
    }
    console.log(`Added test classes, known actives: ${activs.length}`);
}
/*
 * UI management
 */
// Filter nodes that are shown as list or graph
function nodeFilter(node) {
    if (node.hasOwnProperty('hidden') && node.hidden)
        return false;
    let upNam = node.cmpname.toUpperCase();
    if (upNam.includes("TEST") || upNam.includes("TESTS") || upNam.includes("MOCK"))
        if (!confPane.displayTests)
            return false;
    // check if all nodes tags are in the deselected tags
    let tagsDsel = node.tags.every(a => govPane.dselTags.includes(a));
    if (tagsDsel && node.tags.length > 0)
        return false;
    return true;
    /*	displayMetrics
    if ((!viewSingles) && (node.children.length === 0) && (node.children.parents === 0))
        return false;
    if ((!viewInactive) && (node.active === false))
        return false;
    if ((!viewActive) && (node.active === true))
        return false;
    if (node.parents.length > maxparents)
        return false;
    return true;
*/
}
// list parents of children to a collection of nodes
function listParentsAndChildren(cmpName, themap, xcommons, upanddown) {
    console.log("rendering parents and children for " + cmpName);
    themap[cmpName] = macomps[cmpName];
    for (let direc of upanddown)
        addGeneration(macomps[cmpName], direc, themap, xcommons);
}
// recursive function used by listParentsAndChildren
function addGeneration(cmp, updown, themap, xcommons) {
    console.log("Search " + updown + " relations for " + cmp.cmptype + "." + cmp.cmpname);
    let cmpNames = (updown === "up") ? cmp.parents : cmp.children;
    for (let aelt of cmpNames) {
        if (themap.hasOwnProperty(aelt))
            continue; // no loop
        let acmp = macomps[aelt];
        themap[aelt] = acmp;
        console.log("adding " + acmp.cmpname + " for " + cmp.cmpname);
        if (acmp.hasOwnProperty('cluster') && acmp.cluster === "commons" && !xcommons)
            continue;
        addGeneration(acmp, updown, themap, xcommons);
    }
    console.log("map size " + Object.keys(themap).length);
}
// show the cluster with specific name as a graph
function showCluster(moname) {
    let ndMap = {};
    console.log("rendering for " + moname);
    let clKeys = allClusters[moname];
    for (let eltkey of clKeys)
        ndMap[eltkey] = macomps[eltkey];
    // add commons elements linked to cluster
    for (let eltkey of allClusters['commons']) {
        let cmElt = macomps[eltkey];
        let inPar = clKeys.some(r => cmElt.parents.includes(r));
        let inChild = clKeys.some(r => cmElt.children.includes(r));
        if (inPar || inChild)
            ndMap[eltkey] = macomps[eltkey];
    }
    console.log("gen view for nb elements " + Object.keys(ndMap).length);
    console.log('gen view elts:' + Object.values(ndMap).map(a => a.cmptype + '.' + a.cmpname));
    mainPane.ndListSelected(ndMap);
}
// apply a domain tag to a component or comp+children or cluster
function tagModule(mname) {
    let tagwhat = document.getElementById('tagwhat').value;
    console.log("tagwhat: " + tagwhat);
    if (currentNodePane.cNode instanceof Cmpinfo) {
        if (tagwhat === 'component')
            addmodule(currentNodePane.cNode, mname);
        if (tagwhat === "compAndParents") {
            let morenodes = {};
            morenodes[currentNodePane.cNode.sfid] = currentNodePane.cNode;
            addGeneration(currentNodePane.cNode, "parents", morenodes, false);
            console.log(JSON.stringify(morenodes));
            Object.values(morenodes).map(n => addmodule(n, mname));
        }
        if (tagwhat === "compAndChildren") {
            let childnodes = {};
            childnodes[currentNodePane.cNode.sfid] = currentNodePane.cNode;
            addGeneration(currentNodePane.cNode, "children", childnodes, false);
            console.log(JSON.stringify(childnodes));
            Object.values(childnodes).map(n => addmodule(n, mname));
        }
        if (tagwhat === "cluster") {
            let clnodes = allClusters[currentNodePane.cNode.cluster].map(k => macomps[k]);
            Object.values(clnodes).map(n => addmodule(n, mname));
        }
        mainPane.refreshView();
    }
}
function addmodule(elt, mname) {
    if (!elt.hasOwnProperty("tags"))
        elt.tags = [];
    if (!elt.tags.includes(mname))
        elt.tags.push(mname);
}
async function writeDataToFile() {
    const options = {
        types: [
            {
                description: 'Javascript Files',
                accept: {
                    'javascript/*': ['.js'],
                },
            },
        ],
    };
    const handle = await window.showSaveFilePicker(options);
    const writable = await handle.createWritable();
    await writable.write("let tagList = " + JSON.stringify(tagList) + ";\nlet macomps = " + JSON.stringify(macomps) + ";\nlet allClusters = " + JSON.stringify(allClusters) + ";");
    // Close the file and write the contents to disk.
    await writable.close();
    /*
        const directoryHandle = await window.showDirectoryPicker();
    
        const all = getAllFiles(); // This is again an array of 'File' objects
        for (const file of all) {
          const fileHandle = await directoryHandle.getFile(file.name, {create: true});
          const writable = await fileHandle.createWritable();
          await writable.write(file.content);
          await writable.close();
        }
    */
    alert('Done');
}
/*
 * Header selection menu
 */
class MenuPane {
    constructor(menuItems) {
        this.currMode = 'mdtGraph';
        console.log("starting menu init");
        this.pDiv = document.getElementById(menuItems);
        this.pDiv.innerHTML = `
		<button class="menuitem" onclick="menuPane.runmode(event, 'mdtGraph')" class="active">Dependency graph</button>
		<button class="menuitem" onclick="menuPane.runmode(event, 'viewtable')" class="active">Table</button>
		<button class="menuitem" onclick="menuPane.runmode(event, 'filterComps')" class="active">Hide elements</button>
		<button class="menuitem" onclick="menuPane.runmode(event, 'genTests')">Apex test list generator</button>
		<button class="menuitem" onclick="writeDataToFile()">Save data</button>
		`;
        console.log("done menu init");
    }
    runmode(event, newMode) {
        console.log("changing mode from " + this.currMode + " to " + newMode);
        if (newMode === this.currMode)
            return;
        let i = 0;
        for (let elt of this.pDiv.children) {
            elt.className = elt.className.replace(" active", "");
            console.log(elt);
        }
        event.currentTarget.className += " active";
        console.log(event.currentTarget);
        // set mainPane
        if (this.currMode !== "genTests" && newMode === "genTests")
            mainPane = new TestListPane('mainplace');
        if (this.currMode === "genTests" && newMode !== "genTests")
            mainPane = new GraphPane('mainplace', newMode);
        if (mainPane instanceof GraphPane)
            mainPane.setViewType(newMode);
        switch (newMode) {
            case 'genTests':
            case 'mdtGraph':
            case 'mdtGraph':
                cmpListPane = new CmpListPane('menuleft');
                break;
            case 'filterComps':
                cmpListPane = new CmpFilterViewPane('menuleft');
                break;
            default:
                //case "genClusters":
                console.log("which mode was selected ???? " + newMode);
        }
        this.currMode = newMode;
    }
}
/*
 * Global filter to select what is displayed in menu pane, and in graph pane
 */
class ConfPane {
    constructor(conf) {
        this.youngDev = Date.parse("2020-01-01");
        this.displayMetrics = false;
        this.displayTests = false;
        this.xcommons = false;
        console.log("starting global filter init");
        this.pDiv = document.getElementById(conf);
        this.pDiv.innerHTML = `
		<p><input type="date" value="2020-01-01" id="youngDev" onchange="confPane.setYoungDev()">Newer is: &#9997</p>
		<p>
			Metrics color depend on:
			<select name="metric" id="qualityCriteria" onChange="confPane.colorizeMetrics()">
				<option value="nbcalls">nbcalls</option>
				<option value="totaltime">totaltime</option>
				<option value="avgtime">avgtime</option>
				<option value="p95time">p95time</option>
			</select>
		</p>
		<p>List by <input type="button" name="clusterList" value="cluster" onclick="cmpListPane.genConf('cluster')" /> or
			<select id="compType" name="compType" onChange="cmpListPane.genConf('type')">
			</select>
		</p>
		<p> Display:
			<label for="metrics">usage</label>
			<input type="checkbox" id="metrics" name="metrics" value="metrics" onclick="confPane.metricsView()"/>
			<label for="viewTests">tests</label>
			<input type="checkbox" id="viewTests" name="viewTests" value="viewTests" onclick="confPane.testsView()"/>
		</p>

		<p>Display nodes: 
			<select name="viewWhat" id="viewWhat" onChange="mainPane.setViewWhat(this)">
				<option value="updown">updown</option>
				<option value="up">up</option>
				<option value="down">down</option>
				<option value="cluster">cluster</option>
			</select>
			<input type="checkbox" id="xcommons" name="xcommons" value="xcommons" onclick="confPane.setXcommons()"/>
			<label for="viewTests">x commons</label>
		</p>`;
        // update UI menu to select component types 
        let cmptypeselector = document.getElementById('compType');
        let cmpTypes = [...(new Set(Object.values(macomps).map(a => a.cmptype)))].sort();
        for (let opt of cmpTypes) {
            let option = document.createElement("option");
            option.value = opt;
            option.text = opt;
            cmptypeselector.appendChild(option);
        }
        this.colorizeMetrics();
        console.log("done conf pane init");
    }
    colorizeMetrics() {
        let parm = document.getElementById('qualityCriteria').value;
        console.log("coloring based on " + parm);
        let colortable = ['green', 'yellow', 'orange', 'red', 'red3'];
        let allelts = Object.values(mameasures);
        console.log("painting nodes " + allelts.length);
        allelts.sort((a, b) => (a[parm] > b[parm]) ? 1 : -1);
        for (let nd of allelts) {
            let eltpos = Math.floor(5 * allelts.indexOf(nd) / allelts.length);
            nd.color = colortable[eltpos];
            if (eltpos < 0 || eltpos > 4)
                console.log("elt " + nd.name + " " + eltpos + " " + colortable[eltpos]);
        }
    }
    setYoungDev() {
        this.youngDev = Date.parse(document.getElementById('youngDev').value);
    }
    setXcommons() {
        this.xcommons = document.getElementById("xcommons").checked;
        mainPane.refreshView();
    }
    metricsView() {
        this.displayMetrics = document.getElementById("metrics").checked;
        mainPane.refreshView();
    }
    testsView() {
        this.displayTests = document.getElementById("viewTests").checked;
        mainPane.refreshView();
    }
}
/*
 * List of components by type or clusters to select which one to display or include in tests
 */
class CmpListPane {
    constructor(parentDivId) {
        this.pDiv = document.getElementById(parentDivId);
        this.pDiv.innerHTML = '<div id="cmpList"></div>';
        this.pComp = document.getElementById("cmpList");
        this.pComp.addEventListener("click", this.cmpClickEL, true);
        let acmptype = document.getElementById('compType').value;
        this.listCmpOfType(acmptype);
    }
    cmpClickEL(evt) {
        let el = evt.target;
        let elid = el.getAttribute('sfid');
        console.log('Generating graph for node id: ' + elid);
        mainPane.defCurrentNode(elid, false);
        currentNodePane.defCurrentNode(elid);
    }
    ;
    genConf(listMode) {
        // get  configuration
        confPane.colorizeMetrics();
        if (listMode === 'cluster') {
            this.listClusters();
        }
        else {
            let acmptype = document.getElementById('compType').value;
            this.listCmpOfType(acmptype);
        }
    }
    listClusters() {
        clearPanel(this.pComp);
        for (let clustername of Object.keys(allClusters)) {
            if (allClusters[clustername].length === 1)
                continue;
            let aclst = document.createElement('div');
            aclst.className = "mamcluster";
            let clelts = [];
            if (clustername === "commons") {
                clelts.push("<b><i>commons</i></b>");
            }
            else if (clustername === "tests") {
                clelts.push("<b><i>tests</i></b>");
            }
            else
                for (let anode of allClusters[clustername].map(m => macomps[m]))
                    clelts.push(anode.usePict + anode.cmpname + " " + anode.cmptype);
            aclst.innerHTML = clelts.join("<br/>");
            aclst.addEventListener("click", function () { showCluster(clustername); });
            this.pComp.appendChild(aclst);
        }
    }
    listCmpOfType(ctype) {
        clearPanel(this.pComp);
        /*
                this.pDiv.addEventListener("click", function (evt) {
                    console.log('Generating graph for node id: '+ evt.target.sfid);
                    mainPane.defCurrentNode(evt.target.sfid);
                    currentNodePane.defCurrentNode(evt.target.sfid);
                }, true);
        */
        for (let anode of Object.values(macomps).filter(a => a.cmptype === ctype).sort((a, b) => (a.cmpname > b.cmpname) ? 1 : -1)) {
            let aclst = document.createElement('div');
            aclst.className = "mamcluster";
            aclst.innerHTML = anode.usePict + anode.cmpname;
            aclst.setAttribute('sfid', anode.sfid);
            this.pComp.appendChild(aclst);
        }
    }
}
/*
 * Components in the graph to select to display it or not
 */
class CmpFilterViewPane {
    constructor(parentDivId) {
        this.allNodes = {};
        this.pDiv = document.getElementById(parentDivId);
        this.pDiv.innerHTML = '<div id="cmpList"></div>';
        this.pComp = document.getElementById("cmpList");
        this.pComp.addEventListener("click", this.cmpClickEL, true);
        this.allNodes = mainPane.gvNodes;
        console.log("filter pane with nodes nber " + Object.keys(this.allNodes).length);
        for (let anode of Object.values(this.allNodes).sort((a, b) => (a.cmpname > b.cmpname) ? 1 : -1)) {
            let aclst = document.createElement('div');
            aclst.className = anode.hidden ? "mamclusteroff" : "mamcluster";
            aclst.innerHTML = this.useLogo(anode) + anode.cmpname;
            aclst.setAttribute('sfid', anode.sfid);
            this.pComp.appendChild(aclst);
        }
    }
    cmpClickEL(evt) {
        let elt = evt.target;
        let thenode = macomps[elt.getAttribute('sfid')];
        console.log('Change visibility for node id: ' + thenode);
        if ((!thenode.hasOwnProperty("hidden")) || thenode.hidden === false) {
            thenode.hidden = true;
            elt.className = "mamclusteroff";
        }
        else {
            thenode.hidden = false;
            elt.className = "mamcluster";
        }
        mainPane.refreshView();
    }
    ;
    useLogo(anode) {
        //console.log( JSON.stringify(anode));
        var useTag = "&#10060 "; // not used
        if (anode.createdDate > confPane.youngDev)
            useTag = "&#9997 "; // in development
        if (anode.active)
            useTag = "&#9989 "; // in use
        return useTag;
    }
}
/*
 * Information about selected component
 */
class CmpInfoPane {
    constructor(parentDivId) {
        this.cNode = null;
        this.pDiv = document.getElementById(parentDivId);
    }
    defCurrentNode(nodename) {
        console.log("defCurrentNode execution for " + nodename);
        if (macomps.hasOwnProperty(nodename))
            this.cNode = macomps[nodename];
        else if (mameasures.hasOwnProperty(nodename))
            this.cNode = mameasures[nodename];
        if (!this.cNode === null)
            return;
        console.log(this.cNode);
        clearPanel(this.pDiv);
        if (this.cNode instanceof Entryp)
            this.pDiv.innerHTML =
                `<table><tr><td>${this.cNode.cmptype}</td><td>${this.cNode.name}</td></tr>
			<tr><td>Nb calls</td><td>${this.cNode.nbcalls.toLocaleString()}</td></tr>
			<tr><td>Sum time</td><td>${this.cNode.totaltime.toLocaleString()}</td></tr>
			<tr><td>Avg time</td><td>${Math.trunc(this.cNode.avgtime)}</td></tr>
			<tr><td>P95 time</td><td>${Math.trunc(this.cNode.p95time)}</td></tr></table>`;
        if (this.cNode instanceof Cmpinfo)
            this.pDiv.innerHTML =
                `<p><table><tr><td>${this.cNode.cmptype}</td><td>${this.cNode.auraType || ''} ${this.cNode.cmpname}</td></tr>
			<tr><td>id</td><td>${this.cNode.sfid}</td></tr>
			<tr><td>Since</td><td>${new Date(this.cNode.createdDate).toDateString()}</td></tr>
			<tr><td>Last modified</td><td>${new Date(this.cNode.lastModifiedDate).toDateString()}</td></tr>
			<tr><td>description</td><td>${this.cNode.description}</td></tr>
			</table></p>`;
        // OLD -- <input type="button" name="nodeHierarchy" value="Tree" onclick="mainPane.defcurrentnode('${this.cNode.sfid}',false,['up','down'])"></input>
        //console.log(this.pDiv.innerHTML);
        //this.pDiv.innerHTML= `<p>TODO write description and save</p>` + this.pDiv.innerHTML;
    }
}
/*
 * Area to draw the thependency graph
 */
class GraphPane {
    constructor(parentDivId, mode) {
        this.gvNodes = {};
        this.viewType = "mdtGraph";
        this.viewmode = "tree";
        this.upanddown = ["up", "down"];
        this.pDiv = document.getElementById(parentDivId);
        this.viz = new Viz( );
        this.viewType = mode;
        //clearPanel(this.pDiv);
    }
    ndListSelected(ndList) {
        this.gvNodes = ndList;
        this.refreshView();
    }
    defCurrentNode(cmpName) {
        let parentsChildren = {};
        listParentsAndChildren(cmpName, parentsChildren, confPane.xcommons, this.upanddown);
        console.log("gen view for nb elements " + Object.keys(parentsChildren).length);
        this.ndListSelected(parentsChildren);
    }
    setViewWhat(selector) {
        if (["up", "down", "updown"].includes(selector.value)) {
            this.viewmode = "tree";
        }
        else {
            this.viewmode = "cluster";
        }
        if (selector.value === "up")
            this.upanddown = ["up"];
        if (selector.value === "down")
            this.upanddown = ["down"];
        if (selector.value === "updown")
            this.upanddown = ["up", "down"];
    }
    setViewType(vtype) {
        if (vtype !== this.viewType) {
            this.viewType = vtype;
            this.refreshView();
        }
    }
    // Generate graphviz description of nodes per category
    refreshView() {
        clearPanel(this.pDiv);
        let gvNodes2 = {};
        Object.keys(this.gvNodes).filter(a => nodeFilter(macomps[a])).forEach(a => gvNodes2[a] = macomps[a]);
        let measures = Object.values(gvNodes2).flatMap(n => n.metrics).map(n => mameasures[n]);
        if (this.viewType === "viewtable") {
            this.refreshViewTable(gvNodes2, measures);
        }
        else {
            this.refreshViewGraph(gvNodes2, measures);
        }
    }
    refreshViewTable(gvNodes2, measures) {
        this.pDiv.innerHTML = `<table class="cmpList">
		<thead><tr><th>use</th><th>type</th><th>name</th><th>tags</th></tr></thead><tbody>
  		${Object.values(gvNodes2).map(n => `<tr><td>${n.usePict}</td><td>${n.cmptype}</td><td>${n.cmpname}</td><td>${n.tags.join(", ")}</td></tr>`).join("")}
          </tbody></table>`;
    }
    async refreshViewGraph(gvNodes2, measures) {
        let measurenodes = confPane.displayMetrics ? measures.map(m => m.gvNode()).join('') : '';
        let cmpnodes = Object.values(gvNodes2).map(n => n.gvNode()).join('');
        let nodeRels = Object.values(gvNodes2).map(n => n.gvEdge(gvNodes2)).join('');
        let gvGraph = `
		digraph mygraph { 
			splines = true;
			nodesep =0.1;
			ranksep=0.4;
			rankdir=LR;
		
			node [shape=rect,style="filled,rounded",fillcolor=cadetblue1,color=grey50,penwidth=0.5,fontsize=9, labelfontsize=9, width=1, height=0];
	
			${measurenodes}
			${cmpnodes}
			${nodeRels}
		}`;
        console.log(gvGraph);
        //this.pDiv.innerHTML = Viz(gvGraph, "svg");
        try {
            let graphsvg = await this.viz.renderSVGElement(gvGraph);
            this.pDiv.appendChild(graphsvg);
        }
        catch (error) {
            this.viz = new Viz( );
        }
        this.pDiv.addEventListener('click', function (event) {
            let elt = event.target;
            if (!(elt instanceof SVGTextElement))
                return;
            var ename = '';
            console.log(elt.parentNode);
            for (let an of elt.parentNode.children)
                ename = (an.nodeName === "title") ? an.innerHTML : ename;
            ename = ename.substring(1); // remove heading "_" because graphviz variable name can not start by number
            console.log("node selected: " + ename);
            if (ename) {
                currentNodePane.defCurrentNode(ename);
            }
        }, false);
    }
}
/*
 * Information about selected components and their test classes
 */
class TestListPane {
    constructor(parentDivId) {
        this.gvNodes = {};
        this.selnodes = new Set();
        this.seltests = new Set();
        this.pDiv = document.getElementById(parentDivId);
        clearPanel(this.pDiv);
    }
    ndListSelected(ndList) {
        //this.gvNodes = ndList
        this.refreshView();
    }
    defCurrentNode(cmpName, xcommons) {
        clearPanel(this.pDiv);
        this.selnodes.add(cmpName);
        this.gvNodes[cmpName] = macomps[cmpName];
        let parentsChildren = {};
        listParentsAndChildren(cmpName, parentsChildren, xcommons, ["up", "down"]);
        let theTests = Object.values(parentsChildren).filter(a => a.cmptype === "ApexClass" && (a.cmpname.toUpperCase().includes('TEST') || a.cmpname.toUpperCase().includes('MOCK'))).map(a => a.cmpname);
        this.seltests = new Set([...this.seltests, ...theTests]);
        console.log(`aa ${[...this.selnodes].join(" ")}   bbb ${[...this.seltests].join(" ")}`);
        let assets = [...this.selnodes];
        this.pDiv.innerHTML = `<div class="row">
			<div class="column"><h3>Selected assets</h3>${assets.map(a => "(" + macomps[a].cmptype + ") " + macomps[a].cmpname).join("<br/>")}</div>
			<div class="column">${[...this.seltests].join(", ")}</div>
		  </div>`;
    }
    async refreshView() { }
    ;
}
/*
 * Management of tags
 */
class GovPane {
    constructor(parentDivId) {
        this.pDiv = document.getElementById(parentDivId);
        clearPanel(this.pDiv);
        this.dselTags = [];
    }
    initPane() {
        clearPanel(this.pDiv);
        let listTags = Object.keys(tagList).map(t => `${tagList[t]} ${t}`).join(', ');
        let flagTags = Object.keys(tagList).map(t => `<input type="button" name="${t}" value="${tagList[t]}" onclick="tagModule('${t}')" />`).join('');
        let viewTags = Object.keys(tagList).map(t => `<button type="button" class="${this.dselTags.includes(t) ? 'inactive' : 'active'}" onclick="govPane.viewTag(event,'${t}')">${tagList[t]}</button>`).join('');
        this.pDiv.innerHTML =
            `
			<p>Tags: ${listTags}</p>
			<p>
				<input type="button" name="createTag" value="Create tag" onclick="govPane.createTag()"/>
				1 letter <input type="text" id="newTagIcon" name="newTagIcon" minlength="1" maxlength="1" size="1"/>
				name <input type="text" id="newTagName" name="newTagName" minlength="3" maxlength="9" size="10"/>
			</p>
			<p>Tag <select id="tagwhat" name="tagwhat">
					<option value="component">component</option>
					<option value="compAndChildren">comp.+children</option>
					<option value="compAndParents">comp.+parents</option>
					<option value="cluster">cluster</option></select>
				${flagTags}
			</p>
			<p>View: ${viewTags}
			</p>`;
    }
    createTag() {
        let tagName = document.getElementById('newTagName').value;
        let tagIcon = document.getElementById('newTagIcon').value;
        tagList[tagName] = tagIcon;
        this.initPane();
    }
    viewTag(event, tagName) {
        if (this.dselTags.includes(tagName)) { // remove
            this.dselTags = this.dselTags.filter(a => a !== tagName);
            event.currentTarget.className = 'active';
        }
        else { // add
            this.dselTags.push(tagName);
            event.currentTarget.className = 'inactive';
        }
        mainPane.refreshView();
    }
}
/*
 * Init of the mamet web app
 */
function initTheApp() {
    // generate objects from json to be able to use methods...
    Object.keys(macomps).forEach(n => {
        let newc = new Cmpinfo();
        let oldc = macomps[n];
        Object.assign(newc, oldc);
        newc.createdDate = oldc.hasOwnProperty('createdDate') ? oldc.createdDate : 0;
        newc.lastModifiedDate = oldc.hasOwnProperty('lastModifiedDate') ? oldc.lastModifiedDate : 0;
        macomps[n] = newc;
    });
    Object.keys(mameasures).forEach(n => {
        let newc = new Entryp();
        let oldc = mameasures[n];
        Object.assign(newc, oldc);
        mameasures[n] = newc;
    });
    mergeEVMONstats();
    tagActiveComponents();
}
initTheApp();
let confPane = new ConfPane('conf');
let menuPane = new MenuPane("topmenu");
let mainPane = new GraphPane('mainplace', 'mdtGraph');
let cmpListPane = new CmpListPane('menuleft');
let currentNodePane = new CmpInfoPane('nodeinfo');
let govPane = new GovPane('nodegov');
govPane.initPane();
