const blueprint = JSON.parse(
    new TextDecoder().decode(Deno.readFileSync(`./plutus.json`)),
);

blueprint.validators.forEach((v: { title: string; compiledCode: string }) => {
    if (v.title.endsWith(".spend")) {
        const name = v.title.split(".")[0];
        console.log(`${name}: \t${v.compiledCode.length / 2} bytes`);
    }    
});