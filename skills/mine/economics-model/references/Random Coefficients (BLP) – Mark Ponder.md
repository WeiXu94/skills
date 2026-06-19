---
title: Random Coefficients (BLP) – Mark Ponder
updated: 2021-04-09 10:35:56Z
created: 2021-04-09 10:30:47Z
---

> 本文由 [简悦 SimpRead](http://ksria.com/simpread/) 转码， 原文地址 [mark-ponder.com](https://mark-ponder.com/tutorials/static-discrete-choice-models/random-coefficients-blp/)

UPDATE: I have added some more efficient code [here](https://mark-ponder.com/tutorials/static-discrete-choice-models/some-modified-blp-code/). I have also added a post on importance sampling [here](https://mark-ponder.com/tutorials/static-discrete-choice-models/random-coefficients-and-importance-sampling/).

This is my attempt to recreate the results in [Berry, Levinsohn, and Pakes (1995)](https://www.google.com/url?sa=t&rct=j&q=&esrc=s&source=web&cd=1&cad=rja&uact=8&ved=0ahUKEwiTgJv58b7VAhVpw4MKHcH8B18QFggoMAA&url=http%3A%2F%2Fciteseerx.ist.psu.edu%2Fviewdoc%2Fdownload%3Fdoi%3D10.1.1.554.3931%26rep%3Drep1%26type%3Dpdf&usg=AFQjCNGY6eRDd-5tsMk7WLk-CFKsRBLtwA). While there will be some derivation of results below, the reader should already be familiar with the theoretical set-up of BLP’s model as I will focus on empirical aspects. For anyone who is interested there are several resources available for people who want a general overview of BLP. [Nevo (2000)](http://faculty.wcas.northwestern.edu/~ane686/research/RAs_guide.pdf) is the gold standard for introducing random coefficient models, focusing on a simple linear index of utility and omitting supply side considerations. I also found notes provided by Eric Rasmusen helpful in understanding the motivation behind several aspects of the model. Additionally, Chapter 64 of the Handbook of Econometrics, “[Structural Econometric Modeling: Rationals and Examples from Industrial Organization](https://ideas.repec.org/h/eee/ecochp/6a-64.html)” has an excellent discussion on structural models and BLP’s original model in particular.

My code is largely based on [Nevo (2000)](http://faculty.wcas.northwestern.edu/~ane686/research/RAs_guide.pdf), [Petrin (2002)](http://www.jstor.org/stable/10.1086/340779), and [Berry, Levinsohn, Pakes (1999)](https://www.aeaweb.org/articles?id=10.1257/aer.89.3.400). [Gentzkow and Shapiro](https://www.brown.edu/Research/Shapiro/pdfs/blp_replication.pdf) have replicated BLP’s 1995 paper in Matlab and their code is much more efficient than what I have programmed below. I found their code difficult to follow and so have written my functions to be less efficient but more clearly tied to the equations they represent. I assume that the reader is already familiar with the theoretical aspects of the model.

#### Data Preparation

The data is the same that was used in BLP’s original analysis and can be found in the supplementary material to Knittel and Metaxoglou’s paper “Estimation of Random-Coefficient Demand Models: Two Empiricists’ Perspective” (which can be found [here](https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/26803)) or the backup material to Gentzkow and Shapiro’s replication study (see [blp_replication.zip](https://web.stanford.edu/~gentzkow/research/)).

```julia
using GLM
using DataFrames
using DataFramesMeta
 
# Read in BLP Dataset
macro R_str(s)
    s
end
cars = readtable(R"D:\Economic Research\Academic\Discrete Choice Models\Static Discrete Choice\Study Replication\Automobile Demand - BLP\Automobile Data.csv", header = true, separator = ',');
 
cars[:ln_hpwt] = log(cars[:hpwt])
cars[:ln_space] = log(cars[:space])
cars[:ln_mpg] = log(cars[:mpg])
cars[:ln_mpd] = log(cars[:mpd])
cars[:ln_price] = log(cars[:price])
cars[:trend] = cars[:market] + 70
cars[:cons] = 1
 
regSet = @linq cars |>
@by(:model_year, s_0 = log(1 - sum(:share)))
 
regSet = join(cars, regSet, on = :model_year);
 
regSet = @linq regSet |>
    @transform(s_i = log(:share)) |>
    @transform(dif = :s_i - :s_0);
 
regSet[:dif_2] = log(regSet[:share]) - log(regSet[:share_out]) ;
regSet[:ln_price] = log(regSet[:price]);
 
regSet = sort(regSet, cols = [:market,  :firmid])
 
markets = convert(Matrix, regSet[:, [ :market] ]);
marks = unique(markets)
firms = convert(Matrix, regSet[:, [ :firmid] ]);
modlist = unique(regSet[:newmodv])
modLoc = regSet[:newmodv];
 
X = convert(Matrix, regSet[:, [ :cons, :hpwt, :air, :mpd, :space] ]) # Demand Variables
W = convert(Matrix, regSet[:, [ :cons, :ln_hpwt, :air, :ln_mpg, :ln_space, :trend] ]) # Supply Variables
p = convert(Matrix, regSet[:, [ :price] ]) # Price
delta_0 = convert(Array, round(regSet[:,:dif_2], 20));
```

I define a custom type in Julia to hold the various model inputs. As my code has evolved the custom type has evolved with it. Because of this, there are a lot of areas when they custom type is used and other parts where it is not. This should be fixed but I have been too lazy up til now.

```julia
type ModelData
    price::Array{Float64}
    X::Array{Float64}
    instDemand::Array{Float64}
    instSupply::Array{Float64}
    y::Array{Float64}
    beta::Array{Float64}
    guess::Array{Float64}
 
    function ModelData( price = [], X = [], instDemand = [], instSupply = [], y = [],
                        delta = [], beta = [] )
        return new(price, X, instDemand, instSupply, y, delta, beta )
    end
end
 
m = ModelData()
m.price = p
m.X = X
m.guess = regSet[:dif_2];
```

#### Utility and Demand

Consumers make their choices based on a arbitrary utility function that depends on a set of random variables, ![](latex_6b098d4f656042539489f03f2658b25c.png) and the various product characteristics ![](latex_dc0b96bd23da4d6e84ab4775ef019e12.png). A consumer will choose product ![](latex_c061a57a7526449ab0a539653b2ed0ca.png) from a set of products ![](latex_c6e0606d0ed44018b8c16359488fa816.png) if ![](latex_810db738852b447e8a115572d627a10b.png). Let ![](latex_cb4f76f691d4446fa3deb900cfde6ed6.png) be the space of all random variable triplets ![](latex_6b098d4f656042539489f03f2658b25c.png) and let ![](latex_8579d9d4c5204ac18edddd14e37d5b32.png) be a distribution over these random variables. If we assume that each consumer has the same basic utility function, we can partition ![](latex_cb4f76f691d4446fa3deb900cfde6ed6.png) into sets of the form ![](latex_443e5b0ce4bc464cb85b799ef2c51450.png). The market share for the ![](latex_c061a57a7526449ab0a539653b2ed0ca.png)th product would them be given by

![](latex_402215937c274912995c9228db35a5f2.png)

Consider a single market and let ![](latex_7a14071fee7f41f7b0a0593b940aa26c.png) be the ![](latex_9c0218ac5272451cabeec22342eb0450.png)th consumer’s utility for the ![](latex_c061a57a7526449ab0a539653b2ed0ca.png)th product. It is generally assumed that the utility function ![](latex_7a14071fee7f41f7b0a0593b940aa26c.png) can be decomposed into three components: ![](latex_ccc1a083b9c34f27845c8b1f5c67e989.png), ![](latex_dca4754ebe3f47dfbbe24befc9bf1f57.png), and ![](latex_7601f5745d884ca09d95c65231d16640.png). Total utility agent ![](latex_9c0218ac5272451cabeec22342eb0450.png) gets for product ![](latex_c061a57a7526449ab0a539653b2ed0ca.png) in market ![](latex_72fdcf761c2445eba14c29610eb9a3f8.png) is then given by ![](latex_56c9bf02841047098df266d097c3be34.png). We call ![](latex_ccc1a083b9c34f27845c8b1f5c67e989.png) the mean utility and it represents the average utility that all consumers get from a given product. We call ![](latex_dca4754ebe3f47dfbbe24befc9bf1f57.png) the individual specific or random term and depends on the random variable ![](latex_fb51af04fd464492bb3067da680b3ccd.png). This term allows for consumers to prefer certain attributes more than others. Finally, ![](latex_7601f5745d884ca09d95c65231d16640.png) is a consumer/product specific utility shock that is assumed to be mean independent of the products attributes. This shock is generally assumed to be distributed as a type I extreme value random variable.

In their original paper, BLP assume that utility takes the following functional form

![](latex_9aec9ea50d7d487f995968442ecbc347.png)

where ![](latex_d38727438e5d40d39c76270581276af2.png) is the agent’s income, ![](latex_e86e822cf26a4f01bfc7c72cf1c5f1d2.png) is the price of product ![](latex_c061a57a7526449ab0a539653b2ed0ca.png), ![](latex_dc0b96bd23da4d6e84ab4775ef019e12.png) is a vector of product attributes (such as miles per gallon or size of the care), ![](latex_336a908245f14ab59be14ae038625fc4.png) is product specific unobserved quality, and ![](latex_a9acf926578e42118efe82a10775ad5b.png) is a consumer specific index which characterizes the strength of ![](latex_9c0218ac5272451cabeec22342eb0450.png)‘s preference for characteristic ![](latex_9968f6fb656c45eeb6023691f68eabee.png). In this setup, ![](latex_a58e9671dcad4435baf1bd0307049c63.png) and ![](latex_bcfa5593a46542f88096da18e66c5402.png). Given our assumption of Type I extreme value errors, we can analytically integrate out the ![](latex_7601f5745d884ca09d95c65231d16640.png) and arrive at a probability that consumer ![](latex_9c0218ac5272451cabeec22342eb0450.png) will choose product ![](latex_c061a57a7526449ab0a539653b2ed0ca.png)

![](latex_ed802f67f73744a396ce553bdd90ab68.png)

BLP considers two models. In the first, ![](latex_1fdcb30de48d47af913c726fe5c786c8.png) which reduces to the standard logit model. In the second, ![](latex_a27d5e4348124486b2fed6b19fc6862d.png), which leads to the random coefficients model.

#### Naive Model of Demand

It is particularly easy to estimate the utility parameters when ![](latex_1fdcb30de48d47af913c726fe5c786c8.png). Note first that

![](latex_aabfe143831847b1899eebcc333a38dd.png)

Dividing through by the probability of choosing the outside good and taking logs gives the expression

![](latex_5ae62eef54694178bcf57a844f6c3005.png)

![](latex_80a84c3d64fa4ca7b0d8cb0ff3afad61.png)

The term ![](latex_918020d1522143afac5936eb72c4b922.png) is not identified (as only the difference in utilities are generally identified in discrete choice frameworks), so it is assumed to be ![](latex_93865624d4c242708975505b858ec678.png). Therefore ![](latex_0102c457143b42ceb3d9fdad3884d943.png). As there are no random attributes to integrate over, ![](latex_9977c3409c1e40a68cb57c1cf4925c02.png) and so ![](latex_3f0925cd31744a29bba7c95796351737.png) can be derived directly from the market shares. We can then estimate ![](latex_7553f1e920b342fd8e75b629bdeb7bf6.png) and ![](latex_09c01d59993249e7a608794a51118ec3.png) using regular OLS. Here, the structural error that we are trying to minimize is ![](latex_f1f7f73387934f96b886c3bb2d6090fa.png), i.e. the unobserved product quality. This will also be the error term that we minimize in the random coefficients setup. Note that in this setup price cannot enter in the ![](latex_0f40ba1cc3f14547bc0193cb8ce53ddf.png) term and so is assumed to have an average effect. That is, we assume that ![](latex_9ae3a129370543ea9ff95284e2774991.png).

```julia
reg = lm(@formula(dif_2 ~ hpwt + air + mpd + space + price), regSet)
```

```julia
function gen_inst( inX, normal = 1 )
    totMarket = similar(inX)
    totFirm = similar(inX)
 
    for m in marks
        sub = inX[find(markets .== m),:]
        firminfo = firms[find(markets .== m),:]
        #modelinfo = modLoc[find(markets .== m),:]
        sameFirm = firminfo .== firminfo'
        #sameProduct = ones(sameFirm) - diagm(ones(size(sub,1), 1)[:])
        z_1 = similar(sub)
        for i = 1:size(sub, 2)
            z_1[:,i] = sum((sub[:,i] .* sameFirm)',1)'
        end
        totFirm[find(markets .== m),:] = z_1
 
        # Within Market
        sub = inX[find(markets .== m),:]
        z_1 = similar(sub)
        for i = 1:size(sub, 2)
            z_1[:,i] = sum((sub[:,i] .* (!sameFirm + sameFirm)),1)
        end
        totMarket[find(markets .== m),:] = z_1
    end
 
    return [totFirm, totMarket]
end
 
tmpDemand = gen_inst(X)
Z = hcat(X, tmpDemand[1], tmpDemand[2])
tmpSupply = gen_inst(W)
Z_s = hcat(W, tmpSupply[1], tmpSupply[2], regSet[:,:mpd]);
 
m.instDemand = copy(Z)
m.instSupply = copy(Z_s)
 
for i = 2:size(m.instDemand,2)
    m.instDemand[:,i] = m.instDemand[:,i] - mean(m.instDemand[:,i])
end
for i = 2:size(m.instSupply,2)
    m.instSupply[:,i] = m.instSupply[:,i] - mean(m.instSupply[:,i])
end
```

#### Price Endogeneity and Instrumental Variables Estimation of Demand

The logit model produces unreasonable estimates of demand elastiticies. BLP report that given the logit parameter estimate on price, 1494 of 2217 models have inelastic demand. This is seemingly inconsistent with profit maximizing behavior. To get a sense of why this is, consider a monopolist’s markup

![](latex_8a36b46f558f41cbb5dc1f3f2565bf33.png)

where ![](latex_9706818b1ea4462283fbb790744c6536.png) is the elasticity of demand and ![](latex_882ade0602c54581a9b11de01b56b86c.png) is the firm’s market share. If ![](latex_97fb926936dd4009afb6297761b2d009.png) then the markup is in between ![](latex_323895fb1ff34965b21a384c2982d8d6.png) and prices are positive. However, if ![](latex_42a267ed72044acdb8881eb4f06d8241.png) then this would imply that marginal revenue (and therefore price) is negative. Clearly a firm would never choose a price that would make their marginal revenue negative as that would imply their profits are decreasing.

These abnormal elasticities are due to the endogeneity of price. Cars with large unobserved quality will tend to have higher prices as well. A simple remedy would be to instrument for price in the logit model. BLP propose using three sets of instruments  
1. The observed product characteristics (which are assumed orthogonal to the unobserved characteristics)  
2. The sum of product characteristics for all models marketed by a single firm in a given market.  
3. The sum of product characteristics for all models in a given market.

BLP ([1993](http://www.nber.org/papers/w4264)) and Bresnahan, Stern, and Trajtenberg ([1997](https://www.jstor.org/stable/3087454)) both provide useful discussions on why these are valid instruments. In BLP (1995), they actually say that when calculating the second set of instruments one should exclude the product you are calculating the instruments for, i.e. sum over product characteristics of all other products sold by the firm. A similar rule is used for the third set, i.e. just sum over its competitor’s models. I have not seen this used consistently in literature and in fact BLP doesn’t seem to do this in Table III of their paper so I stick to the three sets laid out above. Shapiro and Gentzkow also found a mistake in how BLP calculated their instruments. They multiply each product characteristic by the number of models the firm sells in each market rather than sum across the characteristics. I follow this mistaken calculation so as to match BLP’s original results.

```julia
delta_0 = m.guess
Z = hcat(X, tmpDemand[1], tmpDemand[2])
m.instDemand = copy(Z)
 
baseData = [ m.price m.X]
zxw1 = m.instDemand'baseData
 
bx1 = inv(zxw1'*zxw1)*zxw1'*m.instDemand'delta_0
 
e = delta_0 - baseData * bx1
g_ind = m.instDemand .* e
g = mean(g_ind,1)
demean = g_ind .- g
vg = demean'demean/size(g_ind,1)
w1 = inv(cholfact(Hermitian(vg)))
 
bx2 = inv(zxw1'w1*zxw1)*zxw1'w1*m.instDemand'delta_0
```

A brief review of Generalized Method of Moments techniques are necessary to proceed. The estimate is given by

![](latex_fe12d25cf7094febbb7c84d33d0dedfd.png)

Let ![](latex_f441b24edada4f6688a0e64e2bd61cc7.png). Then our estimate for ![](latex_ef3dfdcf659e4b818eaed4025944d3b7.png) will be given by

![](latex_daac4134db6f41c19fb062d4c1ec8d64.png)

The efficient weighting matrix is given by ![](latex_fa71e1cbe8994f748630a98821de15d2.png), where ![](latex_dea997c361bb454fa3b6a1eb2270ceae.png). We want a consistent estimate of ![](latex_5968e60ce24d4bd69e2d179d944cc02c.png), which we will call ![](latex_9619bdd57bdc4525a728a3feb0947ab9.png). This will be given by

![](latex_4831a8d100564f4194fb11ba8c3a3493.png)

Any ![](latex_6497516f111a40a09b18df602d13b0b3.png) that consistently estimates ![](latex_b8945261659a45da8552ca3a6abac4dc.png) will work to provide a consistent estimate of ![](latex_9619bdd57bdc4525a728a3feb0947ab9.png). It appears that BLP use the identity matrix as their weighting matrix. We therefore use a two step GMM estimation technique. First, estimate ![](latex_6497516f111a40a09b18df602d13b0b3.png) weighting with the identity matrix. Then use these estimated error terms to calculate ![](latex_79f33b6d951c46ad8b6c5cdd680d33b3.png) and run GMM again with this new weighting matrix.

By expanding the objective function and taking derivatives, we get

![](latex_bfdb8ab8621047c38f4a936dcbb9ba3c.png)

![](latex_dfbabfe715b74038b61d30c71e6dc72c.png)

![](latex_2380752d15a1425fbb63bc60de1b8f10.png)

```julia
lm(@formula(ln_price ~ ln_hpwt + air + ln_mpg + ln_space + trend), regSet)
```

```julia
# Estimated means and deviations for lognormal distribution
incomeMeans = [2.01156, 2.06526, 2.07843, 2.05775, 2.02915, 2.05346, 2.06745,
2.09805, 2.10404, 2.07208, 2.06019, 2.06561, 2.07672, 2.10437, 2.12608, 2.16426,
2.18071, 2.18856, 2.21250, 2.18377]
 
sigma_v = 1.72
 
srand(719345)
ns = 1500
v_ik = randn(6,  ns )'
m_t = repeat(incomeMeans, inner = [ns, 1])
 
y_it = exp(m_t + sigma_v * repeat(v_ik[:,end], outer = [length(incomeMeans),1]));
 
unobs_weight = ones(ns)'/ns
```

It is not obvious, but this largely corrects the demand elasticities. BLP reports that with this new coefficient on price, only 22 of the 2217 models have an inelastic elasticity of demand. We still have the unreasonable substitution patterns implied by logit demand systems, leading us to the random coefficients formulation.

#### Naive Model of Supply

Because BLP’s full model jointly estimates supply and demand they provide estimates for a naive model of supply. Marginal cost is assumed to take a Cobb-Douglas form, i.e.

![](latex.php_latex__5Cdisplaystyle__b55eb442dc6c4d9ba.png)

Taking logs of both sides gives the linear form

![](latex.php_latex__5Cdisplaystyle__db215c3b1d0d4a5bb.png)

In a perfectly competitive market price will be equal to marginal cost. Therefore, we can estimate a naive model of supply by regressing the log values of the various car attributes on the log of price.

```julia
function sim_mu(x2, params)
    # Initialize Variables to be used in the calculation
    sub = Float64[]
    count = 0
    incomeDif = zeros(size(x2)[1], ns)
    mu = zeros(size(x2)[1], ns)
    coeffs = similar(params)
    params = abs(params)
 
    for m in marks
        tmp = find(markets .== m)
        count += 1 # Keep track of the number of markets
        sub = x2[find(markets .== m), :] # Product Characteristics for market m
        y = y_it[ns*(count-1)+1:ns*(count), :] # Get current income observations
        v = v_ik
 
        for i = 1:ns
            y_im = y[i]
            v_i = v[i,1:end-1]
 
            mu_ijt = zeros(size(sub)[1],1)
            # Part 1
            incomeDif[find(markets .== m), i] = y_im  # Needed for later calculations
 
            # Part 2
            coeffs[1] = - params[1] / (y_im)
            coeffs[2:end] = params[2:end] .* v_i
            for j in 1:size(sub)[2]
                BLAS.axpy!(coeffs[j] , sub[:,j], mu_ijt )
            end
            # Store the random effects part
            mu[tmp, i] = mu_ijt
        end
    end
    return [exp(mu), incomeDif]
end
@time test = sim_mu( [p convert(Array{Float64,2}, X)], [39.501,  3.612, 0.628, 1.818, 1.050, 2.056]);
```

```julia
function calc_share(expdelta, expmu)
    # Calculate the Market Shares
    # Combine the average effect with the individual random effect
    u_ijt = expdelta .* expmu
    p_ijt = zeros(size(u_ijt)...)
 
    for m in marks
        numer = view(u_ijt, find(markets .== m), : )
 
        prob = numer ./ (1+sum(numer, 1))
        p_ijt[find(markets .== m), :] = prob
    end
 
    # Calculating market shares
    s_jt = p_ijt * unobs_weight' #/ ns
 
    return [s_jt, p_ijt]
end
@time test2 = calc_share( exp(delta_0), test[1]);
```

#### Random Coefficients

We can now consider the case when ![](latex_64eae0fa2e52443bb7490a9d2e782325.png). As with our naive model of demand, we are going to minimize a quadratic form in the unobserved product quality ![](latex_f1f7f73387934f96b886c3bb2d6090fa.png). Our identifying assumption is that the expected unobserved quality is zero, conditional on observed product characteristics (excluding price). That is, ![](latex_d0a85e1c60024cec89c046f51eb6a093.png) and so ![](latex_f4ce3528983b4db89b49027fb71c3c27.png), where ![](latex_929e299b8e9a40b88d4421d319375f0b.png) is a set of instruments constructed from our data on product characteristics (as described above). With these moment conditions we can construct a GMM estimator for ![](latex_204f294937584735b233bcc1fbff8a33.png), ![](latex_fc214d6043b449149f3f2045de614fae.png), and ![](latex_77b44096791d4c2daf9aae46a4f6b3fe.png). The brute force way to solve this problem is to search over the parameter space and find the ![](latex_8d640555a5be468082abaed4e043d258.png) that minimizes ![](latex_3e88a505b1104488a4410c99ebf0da8e.png), where ![](latex_c871b0e2ff7740ba8d43ddb6f4337eb8.png) is an arbitrary weighting matrix. However, BLP’s method is more computationally efficient (this isn’t entirely true, see the literature on MPEC).

Berry (1994) demonstrated that ![](latex_8845ff849cd0405b93e0ad947312304a.png) is uniquely identified for a given set of parameter values ![](latex_fc214d6043b449149f3f2045de614fae.png) and ![](latex_77b44096791d4c2daf9aae46a4f6b3fe.png) and a set of market share observations. Because ![](latex_8845ff849cd0405b93e0ad947312304a.png) is linear in ![](latex_204f294937584735b233bcc1fbff8a33.png) we can invert the system of equations to write ![](latex_204f294937584735b233bcc1fbff8a33.png) in terms of ![](latex_8845ff849cd0405b93e0ad947312304a.png). Then ![](latex_41e7bf6d232042b0ac1a81df814673aa.png). This leads to the following algorithm:

1.  Guess a set of parameter values for ![](latex_77b44096791d4c2daf9aae46a4f6b3fe.png) and ![](latex_fc214d6043b449149f3f2045de614fae.png)
2.  Use a contraction mapping (see below) to solve for the ![](latex_8845ff849cd0405b93e0ad947312304a.png) that sets predicted shares equal to actual shares
3.  Generate instrumental variable estimates of ![](latex_204f294937584735b233bcc1fbff8a33.png) given ![](latex_8845ff849cd0405b93e0ad947312304a.png).
4.  Use ![](latex_204f294937584735b233bcc1fbff8a33.png) to calculate ![](latex_09c01d59993249e7a608794a51118ec3.png) and calculate the moment conditions

We then search over ![](latex_77b44096791d4c2daf9aae46a4f6b3fe.png) and ![](latex_fc214d6043b449149f3f2045de614fae.png) and find the values that minimize the GMM objective function.

##### Simulation

In order to set the predicted market shares to the actual market shares we need to evaluate the following integral

![](latex_9b79bd28602647e7bbbe4a8616e62e3f.png)

where the ![](latex_fb51af04fd464492bb3067da680b3ccd.png) are drawn from a mean zero normal distribution with identity covariance. This integral does not have a closed form solution and so we need to approximate it. BLP’s original paper proposes evaulating this through simulation. They use the simple smooth estimator (which is also referred to as a pseudo-Monte Carlo estimator in the literature)

![](latex_6e2d38f0f1c941438afc9167be68ea02.png)

This simulator works by analytically integrating out the extreme value errors and then evaluating the integrand at ![](latex_2983ed1623ad4433bdaca815d3a9e977.png) draws from the standard normal distribution and averaging. This method appears to be the one most commonly used in empirical work. We can take draws from the standard normal with the following code. Note that income is assumed to be distributed lognormal, so we actually take ![](latex_1387908ea59447b58084392b51ed542f.png) draws and use one of the draws to sample the income distribution. The lognormal distribution is assumed to have the following means (which change by year) and standard deviation (which is constant across years).

```julia
function contraction( delta, x2, theta2w)
    mu = sim_mu( x2, theta2w )[1]
 
    delta0 = exp(delta)
    eps = 1
    act_share = convert(Array{Float64,1}, regSet[:share] ) ### Need to make more general
    count = 0
    flag = 0
    while (count  .0001 && flag == 0)
        s_0 = calc_share(delta0, mu)[1]
 
        delta1 = delta0 .* (act_share ./ s_0)
        eps = maximum(abs((s_0./act_share) - 1))
        delta0 = delta1
        count += 1
        flag = sum(delta0 . 0
    end
    return log(delta0) 
 
end
@time newDelta2 = contraction( (delta_0), [p convert(Array{Float64,2},X)],  [39.501,  3.612, 0.628, 1.818, 1.050, 2.056] )
```

##### Random Utility Term

Following Nevo (2001), I define a function called sim_mu which calculates the random terms in the utility function, ![](latex_75533ef9dfdd4306a63835de9dbe22c3.png). Recall that our utility function is given by

![](latex_9aec9ea50d7d487f995968442ecbc347.png)

The random term is therefore ![](latex_bcfa5593a46542f88096da18e66c5402.png). One issue that needs to be dealt with, which isn’t discussed in BLP (1995) but is mentioned in BLP (1999), is how to handle prices that are greater than a consumer’s income. The log of a negative number is not defined so we need an approximation. Note that

![](latex_e2c9e235bf6b4032b79168224043efed.png)

The Taylor series expansion of the log function gives us

![](latex.php_latex__5Cdisplaystyle__489acfdcb16645e29.png)

which we can substitute for the second term above,. Therefore, our approximation (after dropping higher order terms) to the original formula is given by

![](latex_d921fa23ca9345a7b3767ac3af3d260e.png)

The left-hand side has support ![](latex_61ee62d7e4f549839d852446b925b6b4.png) while the right-hand side has support ![](latex_25be6ff6a9004828a636bb60436392f9.png).

In the below code we only include the term ![](latex_5fe5d76ba72f4ee689f4845001d7c6b4.png) and we include a random coefficient on the constant. This stems from the fact that we assume the outside good has utility

![](latex_29482f7206f54bd7a90082052730e387.png)

We calculate choice probabilities by normalizing ![](latex_cf6dee969c544e48b2d90a124654a45f.png) to be ![](latex_93865624d4c242708975505b858ec678.png). This involves subtracting ![](latex_03fe61f636454abcab2a4852feed2491.png) from all of the inside good utilities. Note also that we need to subtract ![](latex_024b366b89a947bf8a82b8ca496977fe.png). We are implicitly doing this by giving the constant term a random coefficient. This part is not very clear in BLP’s original paper, although it is mentioned in footnote ![](latex_20ccd77aec594cf09e2599ecdadfe036.png).

I use a Basic Linear Algebra Subroutine (BLAS) function to calculate the random terms. This was just to speed up the code and hopefully doesn’t add too much confusion. I calculate the random coefficients in two steps. First, I calculate new coefficients ![](latex.php_latex_%28-_5Calpha__2F_y_75def011688d496b8.png). Second, I multiply each coefficient by its respecitve product characteristic and sum together. BLAS.axpy!(a, x, y) is a function that replaces the value ![](latex_a0ebfd18a6884325b94d69b62f9c131c.png) with ![](latex_ac3fdd138ceb4ef59f038afa1a490248.png).

```julia
function calc_mc(incomeDif, p_ijt, params)
    mc_all = zeros(delta_0)
    alpha = abs(params[1])
    s_jt = p_ijt * unobs_weight' #/ ns
 
    for m in marks
        firm_yr = firms[find(markets .== m),:]
        price = p[find(markets .== m)]
        income = incomeDif[find(markets .== m),:]
        sameFirm = convert(Array{Float64, 2}, firm_yr .== firm_yr')
        yr = p_ijt[find(markets .== m),:]
 
        nobs = size(yr)[1]
        grad = zeros(nobs, nobs)
        for i=1:ns
            grad .+= alpha ./ income[:,i] .* sameFirm .* unobs_weight[i] .* (yr[:,i].*yr[:,i]' - diagm(yr[:,i]))
        end
        subMatrix = - grad #/ ns
        b = inv(subMatrix) * s_jt[find(markets .== m),:]
 
        mc = price - b
        mc[mc.<0] = .001
        mc_all[find(markets .== m), :] = mc
    end
    return mc_all
end
@time t4 = calc_mc(test[2], test2[2], 39.501)
```

##### Calculating Shares

The function calc_share is straightforward. For each consumer, in each market, it calculates the choice probabilities when given both a vector representing ![](latex_86548bd8c7424580855572a6fc9743d4.png) and matrix representing ![](latex_75533ef9dfdd4306a63835de9dbe22c3.png). Note that both of these arguments need to be exponentiated. This is for efficiency reasons that I describe below.

```julia
using NLopt
 
w1 = eye(size(z,2)) # You can change this to a different initial weighting matrix
preMult = inv(zxw'w1*zxw)*zxw'w1*z'
function gmm( y )
    bxw = preMult*y;
    return bxw
end
 
function ObjFunc(theta_2::Vector, grad::Vector)
        m.guess = contraction(m.guess, [m.price m.X], theta_2)
        mu, iD = sim_mu([m.price m.X], theta_2 )
        p_ijt = calc_share(exp(m.guess), mu )[2]
        mc = calc_mc(iD, p_ijt, theta_2[1])
        y = vcat(m.guess, log(mc))
 
        bxw = gmm( y )
        xi_w = y - xw*bxw
        g = z'xi_w/size(xi_w,1)
        quadForm = (g'w1*g*34)[1]
        println(theta_2, ", ", quadForm)
        return quadForm
 
end
 
opt = Opt(:LN_COBYLA, 6)
lower_bounds!(opt, [5.0, 0., 0., 0., 0., 0.])
initial_step!(opt, [3, .5, .5, .5, .5, .5].*.5)
xtol_rel!(opt,1e-2)
maxeval!(opt, 300)
min_objective!(opt, ObjFunc)
 
@time (minf,minx,ret) = NLopt.optimize(opt, [43.501,  3.612, 4.628, 1.818, 1.050, 2.056])
```

##### The Contraction Mapping

The contraction mapping outlined in BLP is given by

![](latex_43ddc3b5aba34581bab6667831b2b357.png)

From a computational stand point, Nevo (2000) recommends using the transformation

![](latex_1ebd2d54b5714479bcce7ec965a4e080.png)

It should be clear that if the former converges the latter will as well. Exponentials are less expensive to calculate than logarithms, and so this can speed up run times. Nevo reports that these are on the order of 10% although I haven’t bothered to test this assertion. It should be noted that much of the random coefficients literature is concerned with finding ways to avoid the contraction mapping. The most significant contribution that is asymptotically equivalent to BLP’s original model is Dube, Fox, and Su’s mathematical program with equilibrium constraints (MPEC). While MPEC uses the KNITRO solver (which you will need a license to use) it runs much faster than the “nested fixed point” method proposed by BLP.

```julia
theta_2 = minx 
 
preMult = inv(zxw'w1*zxw)*zxw'w1*z'
function gmm( y )
    bxw = preMult*y;
    return bxw
end
 
m.guess = contraction(delta_0, [m.price m.X], theta_2)
mu, iD = sim_mu([m.price m.X], theta_2 )
p_ijt = calc_share(exp(m.guess), mu )[2]
mc = calc_mc(iD, p_ijt, theta_2[1])
y = vcat(m.guess, log(mc))
 
bxw = gmm( y )
xi_w = y - xw*bxw
 
g_ind = z.*xi_w
 
g = mean(g_ind,1)
vg = g_ind'g_ind/size(xi_w,1) - g .* g'
 
weight = inv(vg)
 
preMult = inv(zxw'weight*zxw)*zxw'weight*z'
```

##### Calculating Marginal Costs

The above code is sufficient if you are only interested in modeling the demand side. However, estimates may be made more precise if a supply side is also incorporated. Recall from the initial problem set-up that profits for firm $f$ are given by

![](latex_a1522575e7fb4f1b894fa8f449448905.png)

The first order conditions are given by

![](latex_3457e0a396a74233a8c905a6f55129f2.png)

where the ![](latex_f361bbd326994817a66bfd979e286d8e.png) drops out as it is common to both terms in the above expression. Denoting the matrix of partial derivatives as ![](latex_b83f68d0550d48b793ae9c4b4cde63d3.png) we can solve for the vector of marginal costs as

![](latex_a9ad97841b424209b206e11d695a5d22.png)

The market shares formula is given by

![](latex_85987b4cf626445288f58f920c74a6d8.png)

The own-price elasticity is given by the percent change in quantity to a percent change in price. We therefore need to differntiate the market shares with respect to price. Note that the differntiation operator passes through the integral, and so we just need to calculate the derivative of the choice probabilities and then integrate over these. Derivatives take a convenient form for logit models. Remember that the probability of choosing an option with observed characteristic ![](latex_71be318f76b442369a8261e0cecb1567.png) is equal to

![](latex_793b745e5a6640c493c974fa46cd20b8.png)

Taking derivatives with respect to some characteristic ![](latex_1457c738f85d4653b4c53e5057b88076.png) gives

![](latex_2a27c82831f54fa5a00b669c3ef07b17.png)

![](latex_518524d70ec04d8392dcee3824621fb4.png)

Using this formula, we can see that the derivative of the market shares formula with respect to price is given by

![](latex_04823694a85a488b9d2ff7af284d6bf7.png)

Remember that ![](latex_5b94d81e9a884888a1c010628e0adc4a.png) only enters ![](latex_75533ef9dfdd4306a63835de9dbe22c3.png) through ![](latex_5a5ae09e4be04a4bbe71c151bcde298b.png), so ![](latex_d17c3432130f44f9afef50d1b0065845.png).

It can be shown in an analogous manner that the cross-price derivative is given by

![](latex_95b52c00cb3048099ea6faa304b9b856.png)

Replacing the integral by sums and dividing by the number of simulated individuals (called ![](latex_2983ed1623ad4433bdaca815d3a9e977.png) above) gives the estimated own and cross price derivatives.

```julia
function ObjFunc(theta_2::Vector, grad::Vector)
        m.guess = contraction(m.guess, [m.price m.X], theta_2)
        mu, iD = sim_mu([m.price m.X], theta_2 )
        p_ijt = calc_share(exp(m.guess), mu )[2]
        mc = calc_mc(iD, p_ijt, theta_2[1])
        y = vcat(m.guess, log(mc))
 
        bxw = gmm( y )
        xi_w = y - xw*bxw
        g = z'xi_w/size(xi_w,1)*2
        quadForm = (g'weight*g*34)[1]
        println(theta_2, ", ", quadForm)
        return quadForm
 
end
 
opt = Opt(:LN_COBYLA, 6)
lower_bounds!(opt, [5.0, 0., 0., 0., 0., 0.])
initial_step!(opt, [3, .5, .5, .5, .5, .5] * .5)
xtol_rel!(opt,1e-1)
maxeval!(opt, 300)
min_objective!(opt, ObjFunc)
 
@time (minf2,minx2,ret2) = NLopt.optimize(opt,  [43.501,  3.612, 4.628, 1.818, 1.050, 2.056]  )
```

The moment conditions for the GMM function need to be augmented. We do this by creating a block diagonal matrix of the instruments and a block diagonal matrix of the demand and supply structural errors and then interact these two terms together (see the function ObjFunc below).

#### Minimizing the GMM Objective Function

We can implement BLP’s algorithm with the four function above. It appears that BLP use a two step estimation technique. First, they use an identity weighting matrix and calculate initial consistent estimates. With these initial consistent estimates they redraw their random sample using importance sampling (which I will discuss later) and calculate the optimal GMM weighting matrix. They then rerun the algorithm to arrive at their final estimates using the new random draws and weighting matrix.

```julia
using SparseGrids
 
Dim = size(X,2) + 1
nodes, weigths = sparsegrid(Dim,5,kpn)
ns = length(weigths)
v_ik = nodes' * sqrt(2)
unobs_weight = weigths' / sqrt(pi)^Dim
 
# Estimated means and deviations for lognormal distribution
sigma_v = 1.72
 
m_t = repeat(incomeMeans, inner = [ns, 1])
 
# Calculate Sample Incomes
y_it = exp(m_t + sigma_v * repeat(v_ik[:,end], outer = [length(incomeMeans), 1]));
```

```julia
using StatsFuns
#Pkg.add("Primes")
using Primes
 
function Halton(i = 1, b = 3)
    f = 1 # value
    r = 0
    while i > 0
        f = f / b
        r = r + f * mod(i, b)
        i = floor(i/b)
    end
    return r
end
 
function HaltonDraws( k=6, n = 100, primeList = [3, 7, 13, 11, 2, 5])
    draws = zeros(n, k)
    myPrimes = primeList
    for j = 1:k
        draws[:,j] = [norminvcdf( Halton(i, myPrimes[j]) ) for i = 50:50+n - 1]';
    end
    println(myPrimes)
    return draws
end
 
ns = 2000
v_ik = HaltonDraws(6, ns)
unobs_weight = ones(1, size(v_ik, 1))/ns
 
# Estimated means and deviations for lognormal distribution
sigma_v = 1.72
 
m_t = repeat(incomeMeans, inner = [ns, 1])
 
# Calculate Sample Incomes
y_it = exp(m_t + sigma_v * repeat(v_ik[:,end], outer = [length(incomeMeans), 1]));
```

##### Approximate Optimal Weighting Matrix

```julia
theta_2 = minx2
m.guess = contraction(m.guess, [m.price m.X], theta_2)
mu, iD = sim_mu([m.price m.X], theta_2 )
p_ijt = calc_share(exp(m.guess), mu )[2]
mc = calc_mc(iD, p_ijt, theta_2[1])
y = vcat(m.guess, log(mc))
 
bxw = gmm( y )
base_xi_w = y - xw*bxw
 
de = zeros( size(xw, 1), length(minx2) )
ident = eye( length(minx2) )
 
for i=1:length(minx2)
    theta_2 = minx2 + ident[:,i] * .01 * minx2[i]
    m.guess = contraction(m.guess, [m.price m.X], theta_2)
    mu, iD = sim_mu([m.price m.X], theta_2 )
    p_ijt = calc_share(exp(m.guess), mu )[2]
    mc = calc_mc(iD, p_ijt, theta_2[1])
    y = vcat(m.guess, log(mc))
 
    bxw = gmm( y )
    xi_w = y - xw*bxw
 
    de[:,i] = (xi_w - base_xi_w) / (.01 * minx2[i])
end
 
de2 = hcat(de, -xw)
Gamma = z'de2/(size(g_ind,1))
GammaInv = inv(Gamma'Gamma)
 
g_ind = z.*base_xi_w
g = mean(g_ind,1)
vg = g_ind'g_ind/(size(g_ind,1)) - g.*g'
 
variance= GammaInv *Gamma'*vg*Gamma*GammaInv / (size(g_ind,1))
standardErrors = sqrt(diag(variance))
 
hcat(vcat(minx2, bxw), standardErrors )
```

##### Re-estimate Parameters

```julia
function ObjFunc(theta_2::Vector, grad::Vector)
        m.guess = contraction(m.guess, [m.price m.X], theta_2)
        mu, iD = sim_mu([m.price m.X], theta_2 )
        p_ijt = calc_share(exp(m.guess), mu )[2]
        mc = calc_mc(iD, p_ijt, theta_2[1])
        y = vcat(m.guess, log(mc))

        bxw = gmm( y )
        xi_w = y - xw*bxw
        g = z'xi_w/size(xi_w,1)*2
        quadForm = (g'weight*g*34)[1]
        println(theta_2, ", ", quadForm)
        return quadForm

end

opt = Opt(:LN_COBYLA, 6)
lower_bounds!(opt, [5.0, 0., 0., 0., 0., 0.])
initial_step!(opt, [3, .5, .5, .5, .5, .5] * .5)
xtol_rel!(opt,1e-1)
maxeval!(opt, 300)
min_objective!(opt, ObjFunc)

@time (minf2,minx2,ret2) = NLopt.optimize(opt,  [43.501,  3.612, 4.628, 1.818, 1.050, 2.056]  )
```

```
692.216123 seconds (522.84 M allocations: 437.516 GB, 35.45% gc time)
(14.393336822730385,[42.4779,2.51149,4.43821,4.17829,0.0253246,1.80782],:XTOL_REACHED)
```

These estimates are highly sensitive to the seed that you choose for your random number generator. The price coefficient is the only one that appears to be stable, as it is generally in the range of ![](latex_cd6813d9f31e4b4584809a0d26877c75.png) to ![](latex_d57488d08a744db08bc13bfb65b9ee50.png). Adding more draws would help of course, however the program slows down significantly as more draws are added.

##### Computational Notes

Given the model set-up there is a significant discontinuity in the objective function when ![](latex_fc214d6043b449149f3f2045de614fae.png) becomes small enough. The easiest way to see this is to decompose the objective function into two parts, the portion due to the demand equations and the portion due to the supply equations. The magnitude of the demand moments are less sensitive to changes in ![](latex_fc214d6043b449149f3f2045de614fae.png) and the ![](latex_4c8a1b34b73648d8a4007a1ace2ae85c.png)s than the demand moments are, and as ![](latex_fc214d6043b449149f3f2045de614fae.png) gets small the supply moments dominate the objective function. That is until all marginal costs are set to ![](latex_8d025db70f854944a8f48e6bbe7bcb46.png) (the lower bound that we put on the marginal costs). Because the dependent variable is constant, it can be approximated so well that the supply moments have a negligible contribution to the GMM function. At this point, changes in the ![](latex_4c8a1b34b73648d8a4007a1ace2ae85c.png) have an imperceptible impact on the supply moments and can be used to push down the demand moments. This leads to a global minimum of the GMM function with ![](latex_3446d63ed5f2417baa004d93c11c4b13.png). This is of course economically unrealistic and more a facet of the lower bound we are forced to put on marginal costs. There are a few ways to avoid this result.

1.  Use a smaller step size in the optimization routine. BLP uses the Nelder-Mead algorithm which uses an initial step size. If you make the step size sufficiently small, then it will converge to an economically relevant minimum. Of course, a smaller step size can lead to convergence to a local minimum and so you will need to start from a number of different points to make sure the algorithm is converging to the global minimum.
2.  Use more draws or use a different form of numerical integration to approximate the tails better. Parameter values are largely determined by the tails of the distributions and better approximations of these tails leads to more rapid increases in the GMM objective function. The majority of the issues that I found came from using Monte Carlo methods with too few draws.

##### Numeric Integration

Judd and Skrainka ([2011](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=1870703)) propose using quadrature to estimate the integral instead. Quadrature evaulates the function at predetermined points called nodes and then calculates a weighted sum of the results, where the weights depend in a complex way on the nodes and the function you are integrating against. Fortunately there are Julia packages available that calculate quadrature nodes and weights for certain types of integrals. Because we are interested in integrating against a normal distribution we can use Gauss-Hermite quadrature for our approximation. The new estimator becomes

![](latex_1e20f00acfca4b9b852f414062a8d27e.png)

(you can see this result derived in the one-dimensional case here). One advantage of using quadrature instead of simulation is that we need fewer nodes to get similar levels of precision. Given that the number of draws is one of the biggest determinants of run time, the savings can be significant. One detriment is that the weights can be negative, leading to negative shares. This is problematic when computing the contraction mapping. The contraction mapping requires that the shares remain positive and sum to one, so if any share becomes negative it will diverge to ![](latex_47a58480d1144749ab87ddc578d6424b.png). This occurs more frequently as you increase the number of nodes you use, as the tails of the distribution become better approximated. Judd and Skrainka use MPEC to estimate the random coefficients model which avoids the contraction mapping and is therefore more robust to use with quadrature based rules.

I was a bit imprecise earlier when I said that the weights can be negative. Traditional quadrature actually has non-negative weights, but requires the integrand to be evaluated at a significant number of nodes. An alternative is to use sparse grid quadrature, which takes advantage of the normal distributions symmetry to calculate nodes and weights. The trade off is that you need to use fewer nodes but the weights may be negative. We can use calculate the nodes and weights using the Julia package SparseGrids. Again, note the normalization in calculating the nodes and weights.

```julia
using SparseGrids

Dim = size(X,2) + 1
nodes, weigths = sparsegrid(Dim,5,kpn)
ns = length(weigths)
v_ik = nodes' * sqrt(2)
unobs_weight = weigths' / sqrt(pi)^Dim

# Estimated means and deviations for lognormal distribution
sigma_v = 1.72

m_t = repeat(incomeMeans, inner = [ns, 1])

# Calculate Sample Incomes
y_it = exp(m_t + sigma_v * repeat(v_ik[:,end], outer = [length(incomeMeans), 1]));
```

To give a sense of how quadrature compares to pseudo-Monte Carlo methods I used a sparse grid approximation of order 5 (so it will integrate polynomials up to 9 degrees precisely). The first stage estimates were

```
447.178553 seconds (594.09 M allocations: 328.282 GB, 17.68% gc time)
(16.322633430097962,[35.9758,3.23863,5.49839,1.61946,0.843252,2.87426],:XTOL_REACHED)
```

and the second stage estimates were

```
222.237679 seconds (270.54 M allocations: 171.822 GB, 17.26% gc time)
(11.138638590017912,[43.5579,4.29131,6.5701,0.240026,0.878732,3.13293],:XTOL_REACHED)
```

The estimates are very similar to those generated from the pseudo-Monte Carlo draws (the coefficient on price is very close to what BLP estimates). The primary difference is the run time. Because we only need 749 points for the quadrature the estimation routine runs in roughly half the time. However, the reason that I used a rule of order 5 is not innocuous. As I tried to increase the order for more precision I began to frequently run into negative shares.

In his book “[Discrete Choice Methods with Simulation](https://eml.berkeley.edu/books/choice2.html)” Kenneth Train suggests using Halton draws to evaluate this integral (this is an excellent book and provided online here). The random draws used for the pseudo-Monte Carlo estimator are serially uncorrelated. While this is not an issue for estimation it does mean that simulation errors tend to die out slowly. Halton draws are a way to create pseudo-random draws that are negatively correlated, which in effect cause the simulation errors to decrease more rapidly. You will often get similar levels of precision to the pseudo-Monte Carlo estimates with a tenth of the number of draws (see Bhat (2001)). The drawback is that the theoretical properties of using Halton draws have note been investigated and so it is an open question as to how they might impact your results, e.g. introducing bias or inconsistency, etc. For a discussion on using Halton Draws, see Train’s book in Chapter 9. The algorithm that I use below is based on the Wikipedia entry, found here.

```julia
using StatsFuns
#Pkg.add("Primes")
using Primes

function Halton(i = 1, b = 3)
    f = 1 # value
    r = 0
    while i > 0
        f = f / b
        r = r + f * mod(i, b)
        i = floor(i/b)
    end
    return r
end

function HaltonDraws( k=6, n = 100, primeList = [3, 7, 13, 11, 2, 5])
    draws = zeros(n, k)
    myPrimes = primeList
    for j = 1:k
        draws[:,j] = [norminvcdf( Halton(i, myPrimes[j]) ) for i = 50:50+n - 1]';
    end
    println(myPrimes)
    return draws
end

ns = 2000
v_ik = HaltonDraws(6, ns)
unobs_weight = ones(1, size(v_ik, 1))/ns

# Estimated means and deviations for lognormal distribution
sigma_v = 1.72

m_t = repeat(incomeMeans, inner = [ns, 1])

# Calculate Sample Incomes
y_it = exp(m_t + sigma_v * repeat(v_ik[:,end], outer = [length(incomeMeans), 1]));
```

I ran the estimation routine using 1000 Halton draws using a random sequence of prime numbers (actually a random permutation of the first ![](latex_20ccd77aec594cf09e2599ecdadfe036.png) prime numbers). Here are the results

```
423.846489 seconds (374.58 M allocations: 244.325 GB, 37.97% gc time)
(24.47760690688335,[30.5585,2.00234,2.77162,3.27645,0.317881,0.0],:XTOL_REACHED)
```

and the second stage estimates were

```
310.120252 seconds (231.79 M allocations: 171.579 GB, 39.66% gc time)
(14.616969374249717,[43.4435,2.11105,3.44915,2.02088,0.299518,0.455816],:XTOL_REACHED)
```

Halton draws do appear to perform better than the pseudo-Monte Carlo draws. They also appear to compare favorably to quadrature and avoid the issue of negative market shares. However, there is till a large variation when it comes to choosing the order of your primes. Below is a selection of 20 different permutations using ![](latex_db4a404e0af14e99b7970d6585deb6d3.png) draws each.

```
[3,13,5,7,11,2]
(8.436375185058576,[39.7409,4.80046,3.02638,4.30049,0.043742,2.16608],:XTOL_REACHED)
[3,2,5,7,13,11]
(8.126970330811496,[38.379,4.98949,3.22361,5.87349,4.57709e-18,5.55112e-19],:XTOL_REACHED)
[11,2,13,3,7,5]
(8.281354450784724,[47.1244,4.25148,3.60036,1.89378,1.51985e-19,1.02716e-33],:XTOL_REACHED)
[5,7,13,3,11,2]
(8.004086471346755,[40.3787,5.07477,3.86652,4.73931,0.333077,1.59143],:XTOL_REACHED)
[3,7,13,5,2,11]
(8.806204934089184,[45.8064,3.46805,4.48342,2.39208,0.344699,2.06688],:XTOL_REACHED)
[5,13,2,3,11,7]
(7.91977691414021,[49.3665,3.60608,5.75227,2.88326,0.213072,1.63706],:XTOL_REACHED)
[11,5,2,3,13,7]
(8.199763136939843,[43.1127,4.3867,4.54713,4.2257,0.0609809,2.77556e-19],:XTOL_REACHED)
[13,7,3,5,11,2]
(8.141588621576702,[48.4785,4.59091,3.84852,2.00489,0.249055,0.302077],:XTOL_REACHED)
[3,5,11,13,2,7]
(8.037840784698098,[41.2783,4.62048,4.9107,4.7229,6.93889e-18,2.16878],:XTOL_REACHED)
[2,7,3,11,13,5]
(8.314772240236219,[49.3797,1.76477,1.23341,4.22146,6.93889e-18,2.63216],:XTOL_REACHED)
[11,2,13,3,7,5]
(8.389703007299477,[41.7569,4.55971,4.56189,2.0751,0.155372,1.15924],:XTOL_REACHED)
[5,11,13,2,3,7]
(7.311091187054691,[50.6297,3.23043,1.95696,6.12793,5.51136e-19,1.48309],:XTOL_REACHED)
[3,13,7,2,11,5]
(7.975776111976936,[51.1548,0.0,5.90186,4.70691,2.77556e-19,2.65734],:XTOL_REACHED)
[13,11,5,7,3,2]
(7.4030259001242085,[50.6504,4.69235,1.27391,4.75771,0.24332,0.842979],:XTOL_REACHED)
[3,13,11,5,2,7]
(8.141840785186503,[45.6043,4.95684,5.2669,2.32044,0.0,2.71834],:XTOL_REACHED)
[7,3,5,2,13,11]
(8.198262419497787,[44.0319,4.47802,1.85758,5.59819,0.0,0.525004],:XTOL_REACHED)
[2,13,3,5,7,11]
(8.094371918095108,[42.5261,3.64256,6.31567,5.40118,0.0456037,2.36173],:XTOL_REACHED)
[3,13,7,11,2,5]
(7.636265599411301,[45.3401,1.96728,7.69974,4.29029,5.20417e-20,3.74455],:XTOL_REACHED)
[13,5,7,3,11,2]
(7.296827100901245,[47.8753,4.23547,2.93748,3.77012,0.131486,3.23347],:XTOL_REACHED)
[3,5,7,11,13,2]
(8.143417852613503,[46.539,4.29459,6.11534,3.23859,0.0,1.32306],:XTOL_REACHED)
```

#### Standard Errors

BLP report that asymptotic standard errors take the form

![](latex_3740f9ccfee547aca88dc33111698fcc.png)

where

![](latex_d625f065f5a3465aa97612f91a30c292.png)

See BLP (1995) for the definitions of the ![](latex_71be318f76b442369a8261e0cecb1567.png)s. It is difficult to find an analytic solution for this derivative. We therefore use a numeric approximation. For each parameter we increase it by a small amount and then calculate the change in the objective function. We only do this for ![](latex_fc214d6043b449149f3f2045de614fae.png) and ![](latex_77b44096791d4c2daf9aae46a4f6b3fe.png) as ![](latex_7553f1e920b342fd8e75b629bdeb7bf6.png) has an analytic form that we can use. The term ![](latex_d0e054da5411470f95bf20fad5e7f4b0.png) is just our standard GMM optimal weighting matrix. BLP ignore ![](latex_9be39d51f4fd4bc19fb0c100587fe688.png) in their calculations and use Monte Carlo methods to estimate ![](latex_354d25f58f034f179b21e754b6edeb50.png). I did not do this last part, although they report that it can increase standard errors by ![](latex_68b478ff13704509a94704b926993e40.png).

```julia
theta_2 = minx2
m.guess = contraction(m.guess, [m.price m.X], theta_2)
mu, iD = sim_mu([m.price m.X], theta_2 )
p_ijt = calc_share(exp(m.guess), mu )[2]
mc = calc_mc(iD, p_ijt, theta_2[1])
y = vcat(m.guess, log(mc))

bxw = gmm( y )
base_xi_w = y - xw*bxw

de = zeros( size(xw, 1), length(minx2) )
ident = eye( length(minx2) )

for i=1:length(minx2)
    theta_2 = minx2 + ident[:,i] * .01 * minx2[i]
    m.guess = contraction(m.guess, [m.price m.X], theta_2)
    mu, iD = sim_mu([m.price m.X], theta_2 )
    p_ijt = calc_share(exp(m.guess), mu )[2]
    mc = calc_mc(iD, p_ijt, theta_2[1])
    y = vcat(m.guess, log(mc))

    bxw = gmm( y )
    xi_w = y - xw*bxw

    de[:,i] = (xi_w - base_xi_w) / (.01 * minx2[i])
end

de2 = hcat(de, -xw)
Gamma = z'de2/(size(g_ind,1))
GammaInv = inv(Gamma'Gamma)

g_ind = z.*base_xi_w
g = mean(g_ind,1)
vg = g_ind'g_ind/(size(g_ind,1)) - g.*g'

variance= GammaInv *Gamma'*vg*Gamma*GammaInv / (size(g_ind,1))
standardErrors = sqrt(diag(variance))

hcat(vcat(minx2, bxw), standardErrors )
```

```
17×2 Array{Real,2}:
 42.4779      16.1789    
  2.51149      3.41254   
  4.43821      5.59275   
  4.17829      1.90392   
  0.0253246    0.58236   
  1.80782      1.92754   
 -7.08578      0.374612  
  2.74746      0.579396  
 -1.53175      0.10079   
  0.429704     0.0718583 
  3.60274      0.191931  
  1.96949      0.199927  
  0.470318     0.0686119 
  0.757718     0.0273383 
 -0.469276     0.130125  
 -0.365715     0.197932  
  0.00724009   0.00193253
```