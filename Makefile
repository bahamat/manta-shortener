node_modules: package.json
	npm install --production

smf.xml: smf.json node_modules
	json -e 'this.start.exec="$(PWD)/index.js"; this.start.working_directory="$(PWD)"' -f $< | ./node_modules/.bin/smfgen > $@

install: smf.xml
	svccfg import $<

run:
	./index.js | bunyan
